import type { ProgramConfig } from "@/types/database";

/**
 * Position abbreviation → human-readable label for the email body.
 */
const POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeeper (GK)",
  CB: "Center Back (CB)",
  LB: "Left Back (LB)",
  RB: "Right Back (RB)",
  CDM: "Defensive Midfielder (CDM)",
  CM: "Center Midfielder (CM)",
  CAM: "Attacking Midfielder (CAM)",
  LM: "Left Midfielder (LM)",
  RM: "Right Midfielder (RM)",
  LW: "Left Wing (LW)",
  RW: "Right Wing (RW)",
  ST: "Striker (ST)",
  CF: "Center Forward (CF)",
};

/** Defaults used when coach has no threshold set. */
const DEFAULTS = {
  gradYear: 2027,
  positions: ["CM", "CAM"] as string[],
  gpa: 3.75,
  sat: 1320,
  act: 28,
  heightInches: 70,
};

interface SampleEmailPayload {
  sender_email: string;
  sender_name: string;
  subject: string;
  body_plain: string;
}

/**
 * Build a sample recruit email payload that is guaranteed to pass the
 * coach's configured thresholds, so the sample recruit shows up as
 * qualified on their dashboard.
 *
 * Uses RFC 2606 `.example` TLD — impossible to collide with real recruits.
 */
export function buildSampleEmailPayload(
  config: ProgramConfig | null
): SampleEmailPayload {
  // --- Derive values that clear the coach's thresholds ---

  const gradYear =
    config?.accepted_grad_years?.length
      ? config.accepted_grad_years[0]
      : DEFAULTS.gradYear;

  // Pick positions that the coach accepts
  let positions: string[];
  if (config?.accepted_positions?.length) {
    positions = config.accepted_positions.slice(0, 2);
  } else {
    positions = DEFAULTS.positions;
  }

  // GPA: at or above their minimum
  const gpa =
    config?.min_gpa != null
      ? Math.min(4.0, config.min_gpa + 0.15)
      : DEFAULTS.gpa;

  // SAT: at or above their minimum
  const sat =
    config?.min_sat != null
      ? Math.min(1600, config.min_sat + 80)
      : DEFAULTS.sat;

  // ACT: include if coach has a minimum, otherwise omit
  const act =
    config?.min_act != null
      ? Math.min(36, config.min_act + 2)
      : null;

  // Height: clear the tallest per-position minimum the sample's positions need
  let heightInches = DEFAULTS.heightInches;
  if (
    config?.min_height_by_position &&
    Object.keys(config.min_height_by_position).length > 0
  ) {
    for (const pos of positions) {
      const minH = config.min_height_by_position[pos];
      if (minH != null && minH + 2 > heightInches) {
        heightInches = minH + 2;
      }
    }
  }

  const heightFt = Math.floor(heightInches / 12);
  const heightIn = heightInches % 12;

  // --- Format position lines ---
  const positionLines = positions.map((pos, i) => {
    const label = POSITION_LABELS[pos] ?? pos;
    return i === 0
      ? `- Position: ${label}`
      : `- Secondary Position: ${label}`;
  });

  // --- Build email body ---
  const academicLines = [
    `- GPA: ${gpa.toFixed(2)} (unweighted)`,
    `- SAT: ${sat}`,
  ];
  if (act != null) {
    academicLines.push(`- ACT: ${act}`);
  }
  academicLines.push("- Intended Major: Business Administration");

  const body = `Dear Coach,

My name is Sam Sample and I am writing to express my interest in your soccer program. I am currently attending Northfield Academy in Evanston, IL, graduating in ${gradYear}.

Here is a brief overview of my background:

ACADEMICS
${academicLines.join("\n")}

ATHLETIC PROFILE
${positionLines.join("\n")}
- Height: ${heightFt}'${heightIn}" (${heightInches} inches)
- Weight: 160 lbs
- Preferred Foot: Right

CLUB & HIGH SCHOOL
- Club Team: Chicago Fire FC (MLS NEXT)
- High School Team: Northfield Academy Varsity

CONTACT INFORMATION
- Email: sam.sample@q5recruit.example
- Phone: (555) 012-3456
- Location: Evanston, Illinois

HIGHLIGHT VIDEO
https://www.youtube.com/watch?v=dQw4w9WgXcQ

---
NOTE: This is a sample recruit created by Q5 Recruit AI to verify your email pipeline is working correctly. You should see this recruit appear in your dashboard with a full profile and DQS score. You can delete this recruit at any time.
---

Thank you for your time, and I look forward to learning more about your program.

Best regards,
Sam Sample`;

  return {
    sender_email: "sam.sample@q5recruit.example",
    sender_name: "Sam Sample",
    subject: `Interested in Your Soccer Program — Sam Sample (Class of ${gradYear})`,
    body_plain: body,
  };
}
