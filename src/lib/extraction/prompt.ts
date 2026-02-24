/**
 * Build the extraction prompt for Claude API.
 * Uses structured prompting to get consistent JSON output.
 */
export function buildExtractionPrompt(
  subject: string | undefined,
  senderName: string | undefined,
  senderEmail: string | undefined,
  bodyPlain: string
): string {
  return `You are a data extraction assistant for college soccer recruiting. Your job is to extract structured information from emails that prospective student-athletes send to college coaches.

Given the following email, extract all available recruit information. Be thorough but accurate.

RULES:
- Extract the value if it is clearly stated or can be strongly inferred from context.
- Set confidence to "high" if the value is explicitly stated in the email.
- Set confidence to "medium" if the value is reasonably inferred (e.g., inferring state from a known club team's location).
- Set confidence to "low" if you are making a guess with limited evidence.
- Set value to null if the information is not mentioned or cannot be inferred at all.
- For height_inches: Convert any height format to total inches (e.g., 5'11" = 71, "5 foot 10" = 70, "6-1" = 73).
- For club_level: Classify the club/league tier as one of: "mls_next", "ecnl", "ga" (Girls/Boys Academy), "regional", "other", "unknown". Infer from the club name if needed (e.g., "NYCFC Academy" → "mls_next").
- For positions: Use standard abbreviations: GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST, CF. Map informal descriptions (e.g., "center back" → "CB", "striker" → "ST", "goalkeeper" → "GK").
- For gpa: Extract as a decimal (e.g., 3.8). If they mention a weighted GPA, note it but extract the unweighted if both are given.
- For video_url: Extract YouTube, Vimeo, Hudl, or any other video link mentioned.
- The email address from the header may be the recruit's or a parent's. If the email body mentions a different contact email for the recruit, prefer that one.
- IMPORTANT: Emails may contain quoted or forwarded messages below the new content (indicated by lines starting with ">", "On ... wrote:", "---------- Forwarded message ----------", or similar markers). ONLY extract information from the NEW message content above these markers. Ignore all quoted or forwarded text — it often contains the coach's own contact information, not the recruit's.

EMAIL:
Subject: ${subject || "(no subject)"}
From: ${senderName || "Unknown"} <${senderEmail || "unknown"}>

Body:
${bodyPlain}

Respond with ONLY a valid JSON object matching this exact structure (no markdown, no explanation, just the JSON):
{
  "full_name": { "value": "string or null", "confidence": "high|medium|low" },
  "email": { "value": "string or null", "confidence": "high|medium|low" },
  "phone": { "value": "string or null", "confidence": "high|medium|low" },
  "graduation_year": { "value": "number or null", "confidence": "high|medium|low" },
  "current_school": { "value": "string or null", "confidence": "high|medium|low" },
  "city": { "value": "string or null", "confidence": "high|medium|low" },
  "state": { "value": "string or null", "confidence": "high|medium|low" },
  "country": { "value": "string or null", "confidence": "high|medium|low" },
  "positions": { "value": ["array of position abbreviations"] or null, "confidence": "high|medium|low" },
  "preferred_foot": { "value": "string or null", "confidence": "high|medium|low" },
  "height_inches": { "value": "number or null", "confidence": "high|medium|low" },
  "weight_lbs": { "value": "number or null", "confidence": "high|medium|low" },
  "gpa": { "value": "number or null", "confidence": "high|medium|low" },
  "sat_score": { "value": "number or null", "confidence": "high|medium|low" },
  "act_score": { "value": "number or null", "confidence": "high|medium|low" },
  "club_team": { "value": "string or null", "confidence": "high|medium|low" },
  "club_level": { "value": "mls_next|ecnl|ga|regional|other|unknown or null", "confidence": "high|medium|low" },
  "high_school_team": { "value": "string or null", "confidence": "high|medium|low" },
  "video_url": { "value": "string or null", "confidence": "high|medium|low" }
}`;
}
