import type { ClubLevel } from "@/types/database";

export function appendMlsSubleagueMissing(
  fields: string[],
  clubLevel?: ClubLevel | null
): string[] {
  if (clubLevel !== "mls_next") {
    return fields;
  }

  if (fields.includes("mls_subleague")) {
    return fields;
  }

  return [...fields, "mls_subleague"];
}
