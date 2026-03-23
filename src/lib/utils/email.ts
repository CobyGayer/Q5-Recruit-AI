export function normalizeEmail(email: string | null | undefined): string | null {
  return (email || null)?.toLowerCase().trim() ?? null;
}
