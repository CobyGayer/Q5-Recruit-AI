/**
 * Resolve email attachment strings into base64-encoded PDF content.
 * Handles both URL-based and raw base64 attachments from Zapier.
 */

const PDF_BASE64_MAGIC = "JVBER"; // "%PDF" in base64
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 10_000;

interface ResolvedAttachment {
  base64: string;
  mimeType: string;
}

/**
 * Extract a URL string from an attachment value.
 * Handles:
 *   - Plain URL strings
 *   - Zapier file objects ({ url: "..." })
 *   - Zapier multi-line metadata strings ("attachment: https://...\nattachment_id: ...\nmime_type: ...")
 */
function extractUrl(attachment: unknown): string | null {
  if (typeof attachment === "string") {
    const trimmed = attachment.trim();

    // Plain URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed.split(/\s/)[0]; // Take URL before any whitespace
    }

    // Zapier multi-line format: "attachment: https://...\nattachment_id: ..."
    const attachmentMatch = trimmed.match(/^attachment:\s*(https?:\/\/\S+)/m);
    if (attachmentMatch) {
      return attachmentMatch[1];
    }

    // Base64 content
    if (trimmed.startsWith("JVBER") || trimmed.startsWith("data:")) {
      return trimmed;
    }

    console.log("[transcript] Unknown string attachment format:", trimmed.substring(0, 200));
    return trimmed;
  }

  // Zapier file objects: { url: "...", filename: "...", content_type: "..." }
  if (attachment && typeof attachment === "object") {
    const obj = attachment as Record<string, unknown>;
    // Try common URL field names
    for (const key of ["url", "href", "download_url", "attachment", "file", "link"]) {
      if (typeof obj[key] === "string" && obj[key]) {
        return (obj[key] as string).trim();
      }
    }
    console.log("[transcript] Unknown attachment object shape:", JSON.stringify(obj).substring(0, 500));
  }

  return null;
}

/**
 * Attempt to resolve an attachment into base64 PDF content.
 * Accepts strings, URLs, or Zapier file objects.
 * Returns null if the attachment is not a PDF, too large, or unreachable.
 */
export async function resolveAttachmentAsBase64(
  attachment: unknown
): Promise<ResolvedAttachment | null> {
  try {
    const value = extractUrl(attachment);
    if (!value) return null;

    if (isUrl(value)) {
      return await fetchAsBase64(value);
    }

    return parseBase64(value);
  } catch (err) {
    console.warn("[transcript] Failed to resolve attachment:", err);
    return null;
  }
}

/**
 * Find the first PDF attachment from an array of attachments.
 * Accepts mixed types (strings, objects, etc.)
 */
export async function findFirstPdfAttachment(
  attachments: unknown[]
): Promise<ResolvedAttachment | null> {
  for (const attachment of attachments) {
    const resolved = await resolveAttachmentAsBase64(attachment);
    if (resolved) return resolved;
  }
  return null;
}

function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

async function fetchAsBase64(url: string): Promise<ResolvedAttachment | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[transcript] Fetch failed: ${response.status} for ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      // Not obviously a PDF — we'll still check the content below
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE_BYTES) {
      console.warn(`[transcript] Attachment too large: ${buffer.byteLength} bytes`);
      return null;
    }

    const base64 = Buffer.from(buffer).toString("base64");
    if (!base64.startsWith(PDF_BASE64_MAGIC)) {
      return null; // Not a PDF
    }

    return { base64, mimeType: "application/pdf" };
  } finally {
    clearTimeout(timeout);
  }
}

function parseBase64(str: string): ResolvedAttachment | null {
  // Strip data URI prefix if present
  let base64 = str;
  if (base64.startsWith("data:")) {
    const commaIndex = base64.indexOf(",");
    if (commaIndex === -1) return null;
    base64 = base64.slice(commaIndex + 1);
  }

  // Rough size check: base64 is ~4/3 of original size
  const estimatedBytes = (base64.length * 3) / 4;
  if (estimatedBytes > MAX_SIZE_BYTES) {
    console.warn(`[transcript] Base64 attachment too large: ~${Math.round(estimatedBytes)} bytes`);
    return null;
  }

  // Validate PDF magic bytes
  if (!base64.startsWith(PDF_BASE64_MAGIC)) {
    return null; // Not a PDF
  }

  return { base64, mimeType: "application/pdf" };
}
