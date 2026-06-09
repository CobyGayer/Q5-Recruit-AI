/**
 * Build the extraction prompt for Claude API.
 * Uses structured prompting to get consistent JSON output.
 */
export function buildExtractionPrompt(
  subject: string | undefined,
  senderName: string | undefined,
  senderEmail: string | undefined,
  bodyPlain: string,
  isForwarded?: boolean
): string {
  const forwardedRules = `- IMPORTANT: This email was FORWARDED by a college coach. The recruit's original email is embedded below forwarded-message markers (e.g., "---------- Forwarded message ----------", "----- Original Message -----", "Begin forwarded message:").
- Extract recruit information ONLY from the forwarded portion BELOW these markers.
- If the forwarded portion contains a "From:" header (e.g., "From: John Doe <john@example.com>"), use that as the recruit's name and email.
- IGNORE any text the coach added above the forwarded markers — it is not recruit data.
- If there are multiple nested forwards, extract from the innermost (original) message.`;

  const directRules = `- IMPORTANT: Emails may contain quoted or forwarded messages below the new content (indicated by lines starting with ">", "On ... wrote:", "---------- Forwarded message ----------", or similar markers). ONLY extract information from the NEW message content above these markers. Ignore all quoted or forwarded text — it often contains the coach's own contact information, not the recruit's.`;

  const emailContextRules = isForwarded
    ? `- The "From" header above is the COACH who forwarded this email, NOT the recruit. Do not use it as the recruit's contact info.`
    : `- The email address from the header may be the recruit's or a parent's. If the email body mentions a different contact email for the recruit, prefer that one.`;

  return `You are a data extraction assistant for college soccer recruiting. Your job is to extract structured information from emails that prospective student-athletes send to college coaches.

Given the following email, extract all available recruit information. Be thorough but accurate.

RULES:
- Extract the value if it is clearly stated or can be strongly inferred from context.
- Set confidence to "high" if the value is explicitly stated in the email.
- Set confidence to "medium" if the value is reasonably inferred (e.g., inferring state from a known club team's location).
- Set confidence to "low" if you are making a guess with limited evidence.
- Set value to null if the information is not mentioned or cannot be inferred at all.
- For height_inches: Convert any height format to total inches (e.g., 5'11" = 71, "5 foot 10" = 70, "6-1" = 73).
  - For club_level: Classify the club/league tier as one of: "mls_next", "mls_next_homegrown", "mls_next_academy", "ecnl", "ecrl" (ECNL Regional League), "ga" (Girls/Boys Academy), "ga_aspire" (Girls Academy Aspire division), "nal", "dpl", "other", "unknown". Infer from the club name if needed (e.g., "NYCFC Academy" → "mls_next"). If the email mentions Aspire and the recruit's club is Girls Academy or unknown, use "ga_aspire" instead of "ga". If the email mentions ECRL, ECNL-RL, or ECNL regional and the recruit's club is ECNL, use "ecrl" instead of "ecnl". If the club is MLS Next, prefer divisions only when there is explicit evidence: the email or club name mentions "homegrown"/"home-grown" for homegrown, or mentions "MLS Next Academy" (or unambiguous MLS Next-specific "Academy") for academy. If unsure, return "mls_next".
- For positions: Use standard abbreviations: GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST, CF. Map informal descriptions (e.g., "center back" → "CB", "striker" → "ST", "goalkeeper" → "GK").
- For gpa: Extract the unweighted GPA as a decimal between 0.0 and 4.0 (e.g., 3.8). If only a weighted GPA is given or the number is outside 0.0-4.0, set gpa to null.
- For video_url: Extract YouTube, Vimeo, Hudl, or any other video link mentioned.
${emailContextRules}
${isForwarded ? forwardedRules : directRules}

EMAIL:
Subject: ${subject || "(no subject)"}
From: ${senderName || "Unknown"} <${senderEmail || "unknown"}>

Body:
${bodyPlain}

Extract all available recruit information from this email using the extract_recruit_data tool.`;
}
