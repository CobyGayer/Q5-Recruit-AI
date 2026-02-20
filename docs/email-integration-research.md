# Email Integration Feature — Research & Implementation Plan

## Context

Coaches want to email recruits directly from Q5 Recruit AI. Emails should appear to come from the coach's own .edu email address, and recruit replies should go to the coach's real inbox. Today there is no coach-to-recruit email functionality — only a "Copy Email" button on the recruit detail page.

**Constraints that shape everything:**
- Coaches use university .edu addresses (Google Workspace / Microsoft 365)
- Coaches don't control university DNS or email domain settings
- University IT admins often restrict third-party OAuth access
- DMARC enforcement (Google Nov 2025, industry-wide) blocks spoofed From headers
- Microsoft is deprecating Basic Auth SMTP (March–April 2026)

---

## Approaches Evaluated

### ❌ Dead Ends (Do Not Pursue)

| Approach | Why It's Dead |
|---|---|
| **ESP custom From** (Resend/SendGrid with coach's .edu as From) | DMARC enforcement rejects emails where the sending domain doesn't match the From domain. Universities enforce `p=reject`. |
| **SMTP relay with coach credentials** | Microsoft deprecating Basic Auth SMTP (March 2026). Security liability of storing credentials. University IT often disables SMTP AUTH. |
| **Custom domain per institution** | Requires per-university IT negotiations. Universities won't authorize a startup's sending IPs on their domain. |
| **Proxy/alias forwarding** | Thread continuity breaks when coach replies from their real inbox. Essentially building Craigslist email — poor UX for the effort. |

### ✅ Viable Approaches

#### 1. Compose Deep Links (Gmail/Outlook/mailto)
Generate pre-filled compose URLs that open the coach's email client with recipient, subject, and body already filled in. Coach clicks "Send" in their own inbox.

- **Deliverability:** Perfect — sent from coach's actual email infrastructure
- **From address:** Coach's real .edu email
- **Replies:** Go to coach's inbox naturally
- **Coach setup:** Zero
- **University IT dependency:** Zero
- **Tracking:** None (no open/click tracking possible)
- **Implementation:** ~1 day — extend existing "Copy Email" button
- **Cost:** $0

#### 2. Reply-To Pattern (Send via Q5 domain)
Send from `Coach Smith via Q5 Recruit <notifications@q5recruit.ai>` with `Reply-To: coach@university.edu`. Uses existing Resend integration.

- **Deliverability:** Good — SPF/DKIM/DMARC all pass (sending from q5recruit.ai)
- **From address:** Shows Q5 domain, not coach's
- **Replies:** Go to coach via Reply-To header
- **Coach setup:** Zero
- **University IT dependency:** Zero
- **Tracking:** Open/click tracking possible via Resend
- **Implementation:** ~1 day — add Reply-To to existing Resend calls
- **Cost:** Resend usage (current plan likely sufficient)

#### 3. Nylas Integration (OAuth Email API)
Third-party service that handles Gmail/Microsoft OAuth complexity, including Google's CASA verification requirement. Coaches do a one-time "Connect Email" OAuth flow.

- **Deliverability:** Perfect — sends through coach's actual mailbox
- **From address:** Coach's real .edu email
- **Replies:** Go to coach's inbox, appears in Sent folder
- **Coach setup:** One-time OAuth click
- **University IT dependency:** HIGH — admins can block third-party OAuth apps
- **Tracking:** Yes (via Nylas webhooks)
- **Implementation:** 2-4 weeks
- **Cost:** ~$8-15/month per connected account

#### 4. Direct OAuth (Gmail API / Microsoft Graph)
Build OAuth integration directly with Google and Microsoft APIs.

- Same benefits as Nylas, but requires passing Google's CASA security assessment ($500–$75K, 2–6 month timeline, annual renewal). Viable long-term but not for MVP.

---

## Decisions Made

- **Individual + bulk emailing** — both single recruit and batch outreach
- **No tracking needed for MVP** — compose deep links are the primary path
- **Fully personalized AI drafts** — use all extracted recruit data to generate tailored emails

---

## Recommended Strategy: Compose Deep Links with AI Drafts

### Why this approach wins

Compose deep links are the only approach that gives coaches **all three things simultaneously**: their real .edu From address, perfect deliverability, and zero setup burden. Every other approach sacrifices at least one of these. The trade-off (no in-app tracking, coach must click Send in their email client) is acceptable for MVP given the user's priorities.

### Implementation Plan

#### 1. AI Email Draft Generation

**New file:** `src/lib/email/draft.ts`

Call Claude to generate a personalized recruit outreach email using:
- Recruit profile: name, email, GPA, test scores, position, club team, grad year, highlights
- Coach context: full name, program name (from `programs` table)
- DQS score and component breakdown (what makes this recruit stand out)
- Prompt instructs Claude to write a warm, professional outreach email (2-3 paragraphs)

Reuse existing patterns from [extract.ts](src/lib/extraction/extract.ts) for Claude API calls.

**New API route:** `POST /api/email/draft`
- Auth: requires logged-in coach (Supabase session)
- Input: `{ recruitId: string }`
- Fetches recruit data + coach data + program data
- Calls Claude to generate subject + body
- Returns `{ subject: string, body: string }`

**New API route:** `POST /api/email/draft/bulk`
- Auth: requires logged-in coach
- Input: `{ recruitIds: string[] }`
- Generates drafts for multiple recruits in parallel (batch Claude calls)
- Returns `{ drafts: Array<{ recruitId, subject, body }> }`

#### 2. Compose URL Generation

**New file:** `src/lib/email/compose.ts`

Utility functions to generate compose URLs:
```
buildGmailComposeUrl({ to?, bcc?, subject, body }) → string
buildOutlookComposeUrl({ to?, bcc?, subject, body }) → string
buildMailtoUrl({ to?, bcc?, subject, body }) → string
```

- All parameters URL-encoded
- Body is plain text (compose links don't support HTML)
- Supports both `to` (individual) and `bcc` (bulk announcement) — comma-separated emails
- Gmail: `https://mail.google.com/mail/?view=cm&to={to}&bcc={bcc}&su={subject}&body={body}`
- Outlook: `https://outlook.office.com/mail/deeplink/compose?to={to}&bcc={bcc}&subject={subject}&body={body}`
- Mailto: `mailto:{to}?bcc={bcc}&subject={subject}&body={body}`

**URL length limits:** Gmail compose URLs work up to ~8,000 chars. Mailto has ~2,000 char limit on some systems. 50 email addresses in BCC ≈ ~1,500 chars, leaving room for the body. For very large batches or long emails, fall back to copy-to-clipboard.

#### 3. Individual Recruit Email UI

**Modified file:** [recruits/[id]/page.tsx](src/app/(dashboard)/recruits/[id]/page.tsx)

Replace "Copy Email" button with "Email Recruit" button that opens a modal/dialog:

- **Step 1:** Click "Email Recruit" → calls `POST /api/email/draft` → shows loading state
- **Step 2:** Modal shows generated draft with:
  - Editable subject line (text input)
  - Editable email body (textarea)
  - Coach can modify the AI draft before sending
- **Step 3:** Action buttons at bottom:
  - "Open in Gmail" → `buildGmailComposeUrl()` → opens new tab
  - "Open in Outlook" → `buildOutlookComposeUrl()` → opens new tab
  - "Open in Email App" → `buildMailtoUrl()` → triggers default mail client
  - "Copy to Clipboard" → copies subject + body (fallback)

Use existing shadcn/ui `Dialog` component. Pattern from existing modals in the codebase.

#### 4. Bulk Email from Recruits List

**Modified file:** [recruits/page.tsx](src/app/(dashboard)/recruits/page.tsx) (or wherever the recruit list lives)

Add checkbox selection to recruit list/table rows + "Email Selected" button in toolbar (appears when recruits selected). Coach picks between two modes:

**Mode A: "Send Announcement" (BCC)**
For camp invites, questionnaire links, program updates — one email to everyone.

- Single compose link with all selected recruits in BCC field
- AI generates one generic announcement draft (no per-recruit personalization, but coach provides the purpose/topic)
- Coach reviews/edits, clicks one Send button in their email client
- Gmail/Outlook/mailto all support `bcc` parameter
- One email_log entry per recruit (all linked to same batch)

**Mode B: "Personalized Outreach"**
For initial contact, follow-ups — unique email per recruit.

- Calls `POST /api/email/draft/bulk` → generates per-recruit AI drafts in parallel
- Shows review screen where coach can browse/edit each draft
- Sequential "Open Next" button to open one compose link at a time (avoids popup blockers)
- Each draft is tailored using the recruit's profile data (GPA, position, highlights, etc.)

**New API route:** `POST /api/email/draft/announcement`
- Auth: requires logged-in coach
- Input: `{ recruitIds: string[], purpose: string }` (purpose = "camp invite", "questionnaire", etc.)
- Generates one generic draft appropriate for all selected recruits
- Returns `{ subject: string, body: string, bccEmails: string[] }`

**Filtering integration:** Coach can use existing DQS filters (e.g., "80+ DQS") to narrow recruits, select all filtered results, then bulk email.

#### 5. Coach Email Preference (optional)

**DB change:** Add `email_client` column to `coaches` table
```sql
ALTER TABLE coaches ADD COLUMN email_client TEXT DEFAULT 'gmail'
  CHECK (email_client IN ('gmail', 'outlook', 'mailto'));
```

- Set during onboarding or in settings
- Default compose button uses coach's preferred client
- Reduces clicks (skip choosing Gmail/Outlook each time)

#### 6. Email History Log

**New DB table:** `email_log`
```sql
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('gmail', 'outlook', 'mailto', 'clipboard')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- Log when coach clicks a compose link (tracks intent, not confirmed delivery)
- Prevents duplicate outreach — show "Emailed on [date]" badge on recruit cards
- RLS: coaches see only their own log entries

**Key files to create/modify:**

| File | Action | Purpose |
|---|---|---|
| `src/lib/email/draft.ts` | Create | Claude-powered email draft generation |
| `src/lib/email/compose.ts` | Create | Gmail/Outlook/mailto URL builders |
| `src/app/api/email/draft/route.ts` | Create | Single recruit draft API |
| `src/app/api/email/draft/bulk/route.ts` | Create | Personalized bulk draft API |
| `src/app/api/email/draft/announcement/route.ts` | Create | BCC announcement draft API |
| `src/app/(dashboard)/recruits/[id]/page.tsx` | Modify | "Email Recruit" button + modal |
| `src/app/(dashboard)/recruits/page.tsx` | Modify | Bulk selection + "Email Selected" |
| `src/types/database.ts` | Modify | Add EmailLog type |
| `supabase/migrations/004_email_log.sql` | Create | email_log table + RLS |

---

## Future Phases (not in scope for MVP)

### Phase 2: Nylas OAuth (if compose links aren't enough)
- Add "Connect Your Email" in coach settings
- Connected coaches: send directly through their mailbox via Nylas API
- Unconnected coaches: fall back to compose links
- Cost: ~$8-15/month per connected account

### Phase 3: Scale
- EmailEngine (self-hosted) to reduce per-account costs
- Gmail/Outlook add-on for power users
- Direct OAuth if volume justifies CASA certification ($500-$75K)

---

## Blockers & Risks

1. **Compose URL length limits:** Gmail handles ~8K chars, but mailto is ~2K on some systems. 50 BCC addresses ≈ 1,500 chars — fits comfortably in Gmail/Outlook but may push mailto limits for large batches. Fall back to clipboard.
2. **Popup blocking (personalized mode only):** Opening one tab per recruit triggers popup blockers. Solved with sequential "Open Next" UX. BCC announcement mode avoids this entirely (single tab).
3. **Claude API costs:** Personalized bulk = 1 Claude call per recruit. Announcement mode = 1 call total regardless of batch size. Monitor usage.
4. **No delivery confirmation:** Compose links mean we never know if the coach actually clicked Send. The email_log tracks intent, not delivery.

---

## Verification Plan

1. **Compose links:** Test Gmail, Outlook, and mailto deep links across Chrome, Safari, Firefox — verify pre-filled fields render correctly with special characters and line breaks
2. **AI drafts:** Generate drafts for recruits with varying profile completeness — verify quality and personalization
3. **Bulk flow:** Select 5+ recruits, generate drafts, open in Gmail — verify each draft is unique and correctly addressed
4. **URL length:** Test with a long AI-generated draft to verify it doesn't exceed Gmail/Outlook URL limits
5. **Mobile:** Verify mailto links work on iOS/Android and open the default mail app
6. **Email log:** Verify RLS — coach A cannot see coach B's email history
