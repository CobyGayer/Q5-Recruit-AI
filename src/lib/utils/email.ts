export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
