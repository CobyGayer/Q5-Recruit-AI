import type { ClubLevel } from "@/types/database";

export function appendMlsDivisionMissing(
  fields: string[],
  clubLevel?: ClubLevel | null
): string[] {
  if (clubLevel !== "mls_next") {
    return fields;
  }

  if (fields.includes("mls_division")) {
    return fields;
  }

  return [...fields, "mls_division"];
}
