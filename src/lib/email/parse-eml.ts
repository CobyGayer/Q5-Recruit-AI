/**
 * Parse .eml file attachments into structured email data.
 * Used for bulk-forward mode where Gmail sends each original email as a .eml attachment.
 */

import { simpleParser, type ParsedMail } from "mailparser";

const MAX_EML_SIZE_BYTES = 25 * 1024 * 1024; // 25MB per .eml
const FETCH_TIMEOUT_MS = 15_000;

export interface ParsedEmail {
  senderEmail: string | null;
  senderName: string | null;
  subject: string | null;
  bodyPlain: string;
  bodyHtml: string | null;
  receivedAt: string | null;
  /** Nested attachments from inside the .eml, as { url, contentType, filename } or base64 data */
  attachments: EmlAttachment[];
}

export interface EmlAttachment {
  content: string; // base64-encoded
  contentType: string;
  filename: string | null;
}

/**
 * Check whether an attachment looks like a .eml file.
 * Zapier may send it as a URL (with filename/content-type metadata) or as an object.
 */
export function looksLikeEml(attachment: unknown): boolean {
  if (!attachment) return false;

  if (typeof attachment === "string") {
    const lower = attachment.trim().toLowerCase();
    // Zapier multi-line metadata format
    if (lower.includes("mime_type: message/rfc822") || lower.includes(".eml")) {
      return true;
    }
    return false;
  }

  if (typeof attachment === "object") {
    const obj = attachment as Record<string, unknown>;
    const contentType = String(obj.content_type ?? obj.contentType ?? obj.mime_type ?? "").toLowerCase();
    const filename = String(obj.filename ?? obj.name ?? "").toLowerCase();
    return contentType.includes("message/rfc822") || filename.endsWith(".eml");
  }

  return false;
}

/**
 * Extract a downloadable URL from an attachment value.
 * Mirrors the pattern in transcript/attachments.ts.
 */
function extractUrl(attachment: unknown): string | null {
  if (typeof attachment === "string") {
    const trimmed = attachment.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed.split(/\s/)[0];
    }
    // Zapier multi-line format
    const match = trimmed.match(/^attachment:\s*(https?:\/\/\S+)/m);
    if (match) return match[1];
    return null;
  }

  if (attachment && typeof attachment === "object") {
    const obj = attachment as Record<string, unknown>;
    for (const key of ["url", "href", "download_url", "attachment", "file", "link"]) {
      if (typeof obj[key] === "string" && obj[key]) {
        return (obj[key] as string).trim();
      }
    }
  }

  return null;
}

/**
 * Download and parse a single .eml attachment into structured email data.
 */
export async function parseEmlAttachment(attachment: unknown): Promise<ParsedEmail | null> {
  try {
    const url = extractUrl(attachment);
    if (!url) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let buffer: Buffer;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        console.warn(`[parse-eml] Fetch failed: ${response.status} for ${url}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_EML_SIZE_BYTES) {
        console.warn(`[parse-eml] .eml too large: ${arrayBuffer.byteLength} bytes`);
        return null;
      }
      buffer = Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }

    return parseEmlBuffer(buffer);
  } catch (err) {
    console.warn("[parse-eml] Failed to parse .eml attachment:", err);
    return null;
  }
}

/**
 * Parse a raw .eml buffer into structured email data.
 */
async function parseEmlBuffer(buffer: Buffer): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(buffer);

  const senderAddress = parsed.from?.value?.[0];
  const attachments: EmlAttachment[] = (parsed.attachments ?? []).map((att) => ({
    content: att.content.toString("base64"),
    contentType: att.contentType,
    filename: att.filename ?? null,
  }));

  return {
    senderEmail: senderAddress?.address ?? null,
    senderName: senderAddress?.name ?? null,
    subject: parsed.subject ?? null,
    bodyPlain: parsed.text ?? "",
    bodyHtml: parsed.html || null,
    receivedAt: parsed.date?.toISOString() ?? null,
    attachments,
  };
}

/**
 * Extract all attachment URLs from a Zapier multi-line attachment string.
 * Zapier may encode several attachments as one newline-delimited block:
 *   attachment: https://.../email1.eml\nmime_type: message/rfc822\n\nattachment: https://.../email2.eml\n...
 */
function extractAllUrlsFromMultiline(s: string): string[] {
  const urls: string[] = [];
  const regex = /^attachment:\s*(https?:\/\/\S+)/gm;
  let match;
  while ((match = regex.exec(s)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Find and parse all .eml attachments from an attachment list.
 * Returns an array of parsed emails (one per .eml file).
 *
 * Handles Zapier's multi-line string format where several .eml URLs may be
 * packed into a single string attachment — each URL is expanded and parsed
 * independently so all forwarded emails appear in the queue.
 */
export async function findAndParseEmlAttachments(attachments: unknown[]): Promise<ParsedEmail[]> {
  const emlAttachments = attachments.filter(looksLikeEml);
  if (emlAttachments.length === 0) return [];

  // Expand multi-URL string attachments into individual URL strings so that
  // each .eml is downloaded and inserted as its own ingested_emails record.
  const expanded: unknown[] = [];
  for (const att of emlAttachments) {
    if (typeof att === "string") {
      const urls = extractAllUrlsFromMultiline(att);
      if (urls.length > 1) {
        expanded.push(...urls);
        continue;
      }
    }
    expanded.push(att);
  }

  const results: ParsedEmail[] = [];
  for (const att of expanded) {
    const parsed = await parseEmlAttachment(att);
    if (parsed && parsed.bodyPlain) {
      results.push(parsed);
    }
  }

  return results;
}
