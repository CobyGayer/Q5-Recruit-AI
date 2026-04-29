import Anthropic from "@anthropic-ai/sdk";
import type { Recruit, RecruitDqsScore } from "@/types/database";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface DraftContext {
  recruit: Recruit;
  dqsScore: RecruitDqsScore | null;
  coachName: string;
  programName: string;
  institution: string;
  purpose?: string;
}

interface EmailDraft {
  subject: string;
  body: string;
}

function buildRecruitSummary(recruit: Recruit, dqsScore: RecruitDqsScore | null): string {
  const lines: string[] = [];

  if (recruit.full_name) lines.push(`Name: ${recruit.full_name}`);
  if (recruit.graduation_year) lines.push(`Graduation Year: ${recruit.graduation_year}`);
  if (recruit.positions.length > 0) lines.push(`Position(s): ${recruit.positions.join(", ")}`);
  if (recruit.gpa) lines.push(`GPA: ${recruit.gpa}`);
  if (recruit.sat_score) lines.push(`SAT: ${recruit.sat_score}`);
  if (recruit.act_score) lines.push(`ACT: ${recruit.act_score}`);
  if (recruit.club_team) lines.push(`Club Team: ${recruit.club_team}`);
  if (recruit.high_school_team) lines.push(`High School Team: ${recruit.high_school_team}`);
  if (recruit.current_school) lines.push(`School: ${recruit.current_school}`);
  if (recruit.city || recruit.state) {
    lines.push(`Location: ${[recruit.city, recruit.state].filter(Boolean).join(", ")}`);
  }
  if (recruit.height_inches) {
    const ft = Math.floor(recruit.height_inches / 12);
    const inches = recruit.height_inches % 12;
    lines.push(`Height: ${ft}'${inches}"`);
  }
  if (recruit.video_url) lines.push(`Video: ${recruit.video_url}`);

  if (dqsScore) {
    lines.push(`\nDQS Score: ${dqsScore.overall_score}/100`);
    if (dqsScore.ai_summary) lines.push(`AI Summary: ${dqsScore.ai_summary}`);
  }

  return lines.join("\n");
}

function buildOutreachPrompt(ctx: DraftContext): string {
  const recruitSummary = buildRecruitSummary(ctx.recruit, ctx.dqsScore);

  const purposeBlock = ctx.purpose
    ? `\nPURPOSE OF THIS EMAIL:\n${ctx.purpose}\n`
    : "";

  return `You are a college soccer coach writing a personalized recruiting email to a prospective student-athlete. Write a genuine, warm, professional outreach email.

COACH INFO:
Name: ${ctx.coachName}
Program: ${ctx.programName}
Institution: ${ctx.institution}
${purposeBlock}
RECRUIT PROFILE:
${recruitSummary}

INSTRUCTIONS:
- Write as ${ctx.coachName}, the coach — use first person
- Reference specific details from the recruit's profile (academics, position, club team, etc.)${ctx.purpose ? `\n- Focus the email around this purpose: ${ctx.purpose}` : ""}
- Keep the tone warm and personal, not like a formal letter
- 2-3 short paragraphs maximum
- Do NOT include a subject line in the body — only in the JSON
- Do NOT use placeholder brackets like [School Name] — use the actual data provided
- If video_url is available, mention you've watched or will watch their film
- End with a clear next step (e.g., visit campus, fill out questionnaire, reply with questions)
- Plain text only — no HTML, no markdown formatting, no bold or italic
- Sign off with the coach's name

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "subject": "the email subject line",
  "body": "the full email body text"
}`;
}

function buildAnnouncementPrompt(
  coachName: string,
  programName: string,
  institution: string,
  purpose: string,
  recruitCount: number
): string {
  return `You are a college soccer coach writing a group email to ${recruitCount} prospective student-athletes. Write a professional announcement email.

COACH INFO:
Name: ${coachName}
Program: ${programName}
Institution: ${institution}

PURPOSE OF THIS EMAIL:
${purpose}

INSTRUCTIONS:
- Write as ${coachName}, the coach — use first person
- This is going to multiple recruits via BCC, so do NOT use any specific recruit's name
- Use a general greeting like "Hello" or "Hi there"
- Keep it concise — 2-3 short paragraphs
- Include relevant details about the purpose (event date, link, etc. if mentioned)
- End with a clear call to action
- Plain text only — no HTML, no markdown formatting
- Sign off with the coach's name

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "subject": "the email subject line",
  "body": "the full email body text"
}`;
}

function parseJsonResponse(text: string): EmailDraft {
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const parsed = JSON.parse(jsonText);
  if (!parsed.subject || !parsed.body) {
    throw new Error("Response missing subject or body");
  }
  return { subject: parsed.subject, body: parsed.body };
}

/** Generate a personalized outreach email for a single recruit */
export async function generateRecruitDraft(ctx: DraftContext): Promise<EmailDraft> {
  const prompt = buildOutreachPrompt(ctx);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  return parseJsonResponse(textBlock.text);
}

interface RequestInfoContext {
  recruit: Recruit;
  dqsScore: RecruitDqsScore | null;
  coachName: string;
  programName: string;
  institution: string;
  missingFields: string[];
}

export const MISSING_FIELD_LABELS: Record<string, string> = {
  full_name: "full name",
  email: "email address",
  phone: "phone number",
  graduation_year: "graduation year",
  current_school: "current school",
  city: "city",
  state: "state",
  country: "country",
  positions: "position(s) played",
  preferred_foot: "preferred foot",
  height_inches: "height",
  weight_lbs: "weight",
  gpa: "GPA",
  sat_score: "SAT score",
  act_score: "ACT score",
  club_team: "club team name",
  club_level: "club level (e.g., MLS Next, ECNL)",
  high_school_team: "high school team name",
  video_url: "highlight video link",
};

function buildRequestInfoPrompt(ctx: RequestInfoContext): string {
  const recruitSummary = buildRecruitSummary(ctx.recruit, ctx.dqsScore);
  const fieldNames = ctx.missingFields
    .map((f) => MISSING_FIELD_LABELS[f] ?? f)
    .join(", ");

  return `You are a college soccer coach writing a short, friendly email to a prospective student-athlete asking them to provide some missing information from their recruiting profile.

COACH INFO:
Name: ${ctx.coachName}
Program: ${ctx.programName}
Institution: ${ctx.institution}

RECRUIT PROFILE (what we already know):
${recruitSummary}

MISSING INFORMATION TO REQUEST:
${fieldNames}

INSTRUCTIONS:
- Write as ${ctx.coachName}, the coach — use first person
- Address the recruit by first name${ctx.recruit.full_name ? ` (${ctx.recruit.full_name.split(" ")[0]})` : ""}
- Open with a warm, brief line referencing something specific from their profile (their club team, position, school, etc.) to show genuine interest
- Naturally weave in the request for the missing information — do NOT present it as a bulleted checklist unless there are 5+ fields
- If requesting a highlight video link, express enthusiasm about wanting to see them play
- If requesting academic info (GPA, SAT, ACT), frame it as helping evaluate the full picture for the program
- Keep it to 2-3 short paragraphs maximum
- End with an encouraging note and the coach's name
- Plain text only — no HTML, no markdown formatting, no bold or italic
- Do NOT use placeholder brackets like [School Name] — use actual data
- Do NOT include a subject line in the body — only in the JSON

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "subject": "the email subject line",
  "body": "the full email body text"
}`;
}

export interface MissingFieldsTemplateContext {
  recruitFirstName: string | null;
  coachName: string;
  programName: string;
  institution: string;
  missingFields: string[];
}

/** Build a pre-filled missing-info request email from a static template (no AI call) */
export function buildMissingFieldsRequestTemplate(ctx: MissingFieldsTemplateContext): EmailDraft {
  const greeting = ctx.recruitFirstName ? `Hi ${ctx.recruitFirstName},` : "Hi there,";
  const bulletList = ctx.missingFields
    .map((f) => `• ${MISSING_FIELD_LABELS[f] ?? f}`)
    .join("\n");

  const subject = `Quick Question from ${ctx.coachName} at ${ctx.institution}`;
  const body = `${greeting}

Thank you for reaching out about ${ctx.programName} at ${ctx.institution}! We're excited to learn more about you.

To complete your recruitment profile, we just need a few more details. Could you please reply with the following?

${bulletList}

Once we have this information, we'll be able to give your profile a full review.

Looking forward to hearing from you!

${ctx.coachName}
${ctx.programName} | ${ctx.institution}`;

  return { subject, body };
}

/** Generate an email requesting specific missing info from a recruit */
export async function generateRequestInfoDraft(ctx: RequestInfoContext): Promise<EmailDraft> {
  const prompt = buildRequestInfoPrompt(ctx);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  return parseJsonResponse(textBlock.text);
}

/** Generate a generic announcement email for bulk BCC sending */
export async function generateAnnouncementDraft(
  coachName: string,
  programName: string,
  institution: string,
  purpose: string,
  recruitCount: number
): Promise<EmailDraft> {
  const prompt = buildAnnouncementPrompt(coachName, programName, institution, purpose, recruitCount);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  return parseJsonResponse(textBlock.text);
}
