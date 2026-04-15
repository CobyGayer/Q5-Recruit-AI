/**
 * Normalize a recruit's full name into a stable lookup key.
 *
 * Rules (v1) — must match the Postgres normalize_name_key() function exactly:
 *   1. Decompose unicode (NFD) then strip combining diacritical marks (accent folding)
 *   2. Lowercase
 *   3. Replace any run of non-[a-z] characters with a single space
 *   4. Collapse repeated spaces and trim
 *
 * Suffixes like "jr", "sr", "ii" are NOT stripped in v1 — they remain
 * significant to reduce false positives.
 */
export function normalizeNameKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")        // non-alpha runs → single space
    .replace(/\s+/g, " ")
    .trim();
}
