/**
 * Compose URL builders for Gmail, Outlook, and mailto.
 * Generates pre-filled compose links that open the coach's email client.
 */

interface ComposeParams {
  to?: string;
  bcc?: string[];
  subject: string;
  body: string;
  /** Coach's email — used as authuser (Gmail) / login_hint (Outlook) for multi-account selection */
  authuser?: string;
}

/** Gmail compose URL (supports up to ~8,000 chars) */
export function buildGmailComposeUrl({ to, bcc, subject, body, authuser }: ComposeParams): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  if (to) params.set("to", to);
  if (bcc?.length) params.set("bcc", bcc.join(","));
  params.set("su", subject);
  params.set("body", body);
  if (authuser) params.set("authuser", authuser);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Outlook web compose URL */
export function buildOutlookComposeUrl({ to, bcc, subject, body, authuser }: ComposeParams): string {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (bcc?.length) params.set("bcc", bcc.join(","));
  params.set("subject", subject);
  params.set("body", body);
  if (authuser) params.set("login_hint", authuser);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

/** mailto: URI (limited to ~2,000 chars on some systems) */
export function buildMailtoUrl({ to, bcc, subject, body }: ComposeParams): string {
  const params = new URLSearchParams();
  if (bcc?.length) params.set("bcc", bcc.join(","));
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:${to ?? ""}?${params.toString()}`;
}

/** Estimate total URL length for a compose link */
export function estimateComposeUrlLength(params: ComposeParams): number {
  // Use Gmail URL as the reference (longest of the three base URLs)
  return buildGmailComposeUrl(params).length;
}

/** Maximum safe URL length for mailto (conservative) */
export const MAILTO_MAX_LENGTH = 2000;
/** Maximum safe URL length for Gmail/Outlook */
export const WEB_COMPOSE_MAX_LENGTH = 8000;
