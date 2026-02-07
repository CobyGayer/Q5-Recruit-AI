**Product Requirements Document**  
The Recruiting Score AI — MVP

*Coach-First Email Ingestion Model*

Version: 2.0

Date: February 5, 2026

Authors: Coby (Technical Lead) & Spencer Kreitzer (Product/Domain Expert)

Status: Draft

# **Executive Summary**

The Recruiting Score AI MVP is a coach-first web platform that streamlines college soccer recruiting by automatically ingesting recruit emails into a centralized, scored database. Instead of requiring athletes to self-register, the MVP leverages coaches’ existing email workflows: coaches move recruit emails into a designated Gmail folder (or apply a label), which triggers a Zapier automation to export the email content into the platform. An AI extraction layer then parses each email to pull out relevant recruit information—name, academics, athletics, contact details—and auto-generates a structured profile.

Each profile is scored against the coach’s program-specific priorities using a Dynamic Qualification Score (DQS), a weighted formula configured during coach onboarding. Coaches see a clean dashboard of all ingested recruits, ranked by DQS, with organized profile cards displaying academics, athletics, and contact information at a glance.

This MVP focuses exclusively on the coach side of the marketplace, targeting men’s soccer recruiting at Amherst College and a small set of pilot programs. The core hypothesis is that coaches will adopt a tool that plugs directly into their existing email workflow and automatically organizes and scores incoming recruits—eliminating manual triage entirely.

# **Problem Statement**

## **The Coach’s Pain Point**

College soccer coaches receive 50+ recruit emails per week. Each email contains some subset of useful information—GPA, test scores, position, club team, highlight video links—but in inconsistent formats. Coaches must manually read each email, mentally assess fit against their program’s needs, and decide whether to follow up. There is no standardized way to compare candidates, filter by criteria, or maintain an organized pipeline. The result is hours of manual triage, missed candidates, and recruiting decisions driven by whoever happened to email most recently rather than who is the best fit.

## **Why Existing Solutions Fall Short**

* Recruiting platforms (SportsRecruits, NCSA) require athletes to create profiles on yet another platform—adoption is the bottleneck

* Spreadsheets work but require manual data entry and don’t scale

* Email search is unreliable—information is scattered across threads with no structured comparison

* No existing tool connects directly to the coach’s inbox and auto-extracts recruit data

# **Core Hypothesis**

If we plug directly into coaches’ existing email workflows and automatically extract, organize, and score recruit information from the emails they’re already receiving, coaches will adopt the platform with minimal behavior change—because the data comes to them instead of requiring athletes to find and use a new platform.

# **Target Users**

## **Primary: College Soccer Coaching Staffs**

* MVP Pilot: Amherst College Men’s Soccer coaching staff

* Expansion Targets: 3–5 additional D3 men’s soccer programs in NESCAC or similar conferences

* User Persona: Head coach or recruiting coordinator who receives 50+ recruit emails per week and struggles to efficiently identify candidates worth pursuing

*Note: Athletes are not direct users of the MVP. They interact with the system passively by sending emails to coaches. A future phase will introduce athlete-facing features (dashboards, score visibility, self-service profiles).*

# **Scope**

## **In Scope for MVP**

1. Coach Onboarding & Configuration — Questionnaire that captures program requirements and scoring weights

2. Zapier Email Ingestion Pipeline — Gmail folder/label trigger that exports recruit emails into the platform

3. AI Email Extraction — Automated parsing of recruit emails to extract structured profile data

4. Auto-Generated Recruit Profiles — Structured profiles created from extracted email data

5. Dynamic Qualification Score (DQS) — Program-specific score calculated using each coach’s configured weights

6. Coach Dashboard — Filterable database view with recruits sorted/scored by DQS, with clean profile cards

7. Interest Flagging — Coaches can mark recruits as “interested” or “not a fit”

## **Explicitly Out of Scope for MVP**

* Athlete-facing dashboard or login (athletes do not interact with the platform directly)

* Athlete self-registration or profile creation

* Machine learning or model training (scoring uses configurable weighted formulas, not ML)

* Video upload, hosting, or analysis

* In-platform messaging system

* Payment/subscription infrastructure (MVP is free for pilot users)

* Mobile apps

* Multi-sport support

* Transfer portal features

# **Core Platform Flow**

The MVP’s architecture centers on a simple but powerful pipeline that converts unstructured recruit emails into scored, searchable profiles with zero manual data entry by the coach.

## **Step 1: Coach Onboarding**

A coach creates an account (institutional .edu email required, manually verified by admin). During first login, the coach completes a configuration questionnaire that defines their program’s minimum thresholds (GPA, test scores, height by position, accepted grad years, accepted positions) and priority weights across scoring components (academics, competition level, physical attributes, position fit, grad year fit, profile quality). The coach also connects their Gmail account and designates a target folder or label (e.g., “Recruiting Score AI”) where they will move emails they want ingested.

## **Step 2: Email Selection & Zapier Trigger**

When a coach receives a recruit email they want to process, they simply move it to their designated Gmail folder or apply the designated label. This triggers a Zapier automation (Gmail trigger: “New Email in Label/Folder”) that captures the email’s full content—subject line, sender, body text, and any attachments—and sends it as a structured payload to the platform’s ingestion API endpoint via a Zapier webhook action.

## **Step 3: AI Email Extraction**

The platform’s backend receives the email payload and runs it through an AI extraction layer (Claude API or similar LLM) to parse out structured recruit data. The AI identifies and extracts fields including: full name, email address, phone number, graduation year, high school/club team, position(s), GPA, SAT/ACT scores, height/weight, club league level, highlight video URLs, and any other relevant details mentioned in the email. The extraction model is prompted with the platform’s expected schema so it maps freeform email text to structured fields.

## **Step 4: Profile Creation & Scoring**

The extracted data populates a new recruit profile (or updates an existing one if a recruit with the same email already exists). The system immediately calculates the recruit’s DQS against the coach’s configured weights and thresholds. If any minimum threshold is not met, the recruit is marked “Not Qualified” with a specific explanation. If data is incomplete (e.g., the email didn’t mention GPA), those fields are marked as missing and the score reflects the available data with a completeness penalty.

## **Step 5: Coach Dashboard**

The coach opens their dashboard and sees all ingested recruits displayed as clean profile cards, sorted by DQS (highest first). Each card surfaces key information at a glance: name, DQS score (color-coded), position, graduation year, GPA, club level, height, and location. Coaches can filter, sort, flag interest, and drill into full profile detail views.

# **Functional Requirements**

## **1\. Coach Onboarding & Configuration**

### **1.1 Account Creation**

* Coaches create accounts with institutional email (.edu required)

* Manual verification by admin (Spencer) before access granted

* Account tied to specific program (e.g., “Amherst College Men’s Soccer”)

### **1.2 Gmail Integration Setup**

* During onboarding, coach is guided to create a designated Gmail label or folder (e.g., “Recruiting Score AI”)

* Coach connects their Gmail to Zapier (guided setup with instructions)

* Zapier Zap is configured: Gmail trigger (new email in label) → Webhook action (POST to platform API)

### **1.3 Onboarding Questionnaire**

Completed during first login, editable anytime after.

**Section A: Minimum Thresholds (Hard Filters)**

Athletes who don’t meet these are marked “Not Qualified” and excluded from default dashboard views.

| Threshold | Input Type | Notes |
| :---- | :---- | :---- |
| Minimum GPA | Number (0.0–4.0) | Required |
| Minimum SAT | Number | Optional (if blank, no SAT filter) |
| Minimum ACT | Number | Optional (if blank, no ACT filter) |
| Minimum Height | Number per position | Optional (e.g., GK: 72”, CB: 70”) |
| Accepted Grad Years | Multi-select | Which classes are you recruiting? |
| Accepted Positions | Multi-select | Which positions do you need? |

**Section B: Priority Weights**

Coaches allocate priority across scoring components using a tier system. For each component, the coach selects a priority level: Critical (weight: 4), High (weight: 3), Medium (weight: 2), or Low (weight: 1). The system normalizes weights to sum to 100%.

Components to weight: Academic Strength, Competition Level (club tier), Physical Attributes, Position Fit, Graduation Year Fit, Profile Quality/Completeness.

**Section C: Roster Context (Optional)**

| Field | Input Type | Purpose |
| :---- | :---- | :---- |
| High-Need Positions | Multi-select with ranking | Recruits at these positions get bonus points |
| Priority Grad Years | Multi-select with ranking | Recruits in these years get bonus points |
| Roster Spots Available | Number per grad year | Informs urgency weighting |

### **1.4 Configuration Editing**

Coaches can update their configuration anytime via Settings. Changes trigger DQS recalculation for all existing recruit profiles (async background job).

## **2\. Zapier Email Ingestion Pipeline**

### **2.1 Trigger Configuration**

* Trigger: Gmail — “New Email Matching Search” or “New Email in Label”

* Coach applies their designated label to any recruit email they want to process

* Zapier polls for new labeled emails (up to every 2 minutes on paid plans, 15 minutes on free)

### **2.2 Payload Sent to Platform**

The Zapier webhook action sends a POST request to the platform’s ingestion API with the following data:

| Field | Source | Notes |
| :---- | :---- | :---- |
| coach\_id | Configured in Zap | Identifies which coach/program this email belongs to |
| sender\_email | Gmail: From | The recruit’s email address |
| sender\_name | Gmail: From Name | The recruit’s name (if available from email header) |
| subject | Gmail: Subject | Email subject line |
| body\_plain | Gmail: Body Plain | Full plain-text email body |
| body\_html | Gmail: Body HTML | HTML version for richer parsing if needed |
| received\_at | Gmail: Date | Timestamp of the original email |
| attachments | Gmail: Attachments | URLs to any attached files (resumes, transcripts) |

### **2.3 API Endpoint**

* POST /api/ingest/email

* Authenticated via API key (one per coach, generated during onboarding)

* Rate limited to prevent abuse (100 emails/hour per coach)

* Returns 200 with profile ID on success, 422 if extraction fails with details

## **3\. AI Email Extraction**

### **3.1 Extraction Process**

When an email payload arrives at the ingestion endpoint, the backend sends the email body to an LLM (Claude API recommended) with a structured extraction prompt. The prompt instructs the model to extract the following fields from the email text and return them as JSON:

| Field | Type | Extraction Notes |
| :---- | :---- | :---- |
| full\_name | Text | From email signature, opening, or sender name |
| email | Email | From sender address or mentioned in body |
| phone | Phone | If mentioned in signature or body |
| graduation\_year | Integer | Class of 20XX or graduation year mention |
| current\_school | Text | High school name |
| city / state / country | Text | Location if mentioned |
| position(s) | Array | Soccer position(s) mentioned |
| preferred\_foot | Text | If mentioned |
| height | Number (inches) | Convert from any format (e.g., 5’11” → 71\) |
| weight | Number (lbs) | If mentioned |
| gpa | Decimal | If mentioned |
| sat\_score | Integer | If mentioned |
| act\_score | Integer | If mentioned |
| club\_team | Text | Club team name |
| club\_level | Enum | Infer tier: MLS Next, ECNL, GA, Regional, Other |
| high\_school\_team | Text | If mentioned |
| video\_url | URL | YouTube, Vimeo, or Hudl links found in email |

### **3.2 Extraction Confidence**

* The AI returns a confidence level for each extracted field: high, medium, or low

* Fields with “low” confidence are marked as “Needs Review” on the profile

* Coaches can manually edit any extracted field to correct errors

* If the email contains insufficient data to create a meaningful profile (e.g., just a “Hi coach” with no info), the system flags it as “Insufficient Data” and surfaces it separately in the dashboard

### **3.3 Deduplication**

* If an incoming email matches an existing recruit (by email address), the system updates the existing profile rather than creating a duplicate

* Updated fields overwrite previous values only if the new extraction has equal or higher confidence

## **4\. Scoring System**

### **4.1 Dynamic Qualification Score (DQS)**

A 0–100 score calculated against a specific program’s configured requirements and priorities. This is the primary score coaches see in their dashboard.

**DQS Calculation Flow:**

* Threshold Check — If recruit fails ANY minimum threshold, DQS \= “Not Qualified” (with explanation of which threshold failed)

* Component Scoring — Each component scored 0–100 based on recruit data

* Weight Application — Components multiplied by program’s configured weights

* Bonus Modifiers — Additional points for matching high-need positions or priority grad years

* Completeness Penalty — Score adjusted downward proportionally based on missing fields (since email extraction may not capture everything)

* Final Score — Weighted sum normalized to 0–100

### **4.2 DQS Components**

| Component | What It Measures |
| :---- | :---- |
| Academic | GPA \+ standardized test scores relative to program’s academic profile |
| Competition Level | Club league tier as proxy for competition quality |
| Physical Attributes | Height (and optionally weight) relative to position expectations |
| Position Fit | How well recruit’s position matches program’s stated needs |
| Grad Year Fit | Whether recruit’s graduation year aligns with recruiting timeline |
| Profile Completeness | How many fields were successfully extracted from the email |

### **4.3 Handling Missing Data**

Since profiles are auto-generated from emails (not self-reported forms), data will often be incomplete. The scoring system handles this gracefully:

* Missing fields are scored as “Unknown” rather than penalized to zero

* DQS is calculated from available data with a completeness modifier that reduces the score proportionally

* Threshold checks only disqualify on fields that are present (missing GPA does not auto-disqualify; it flags “GPA unknown”)

* Dashboard clearly indicates which fields are missing on each profile so coaches can prioritize follow-up

### **4.4 Score Display**

Coaches see recruits in their dashboard sorted by DQS (highest first). Each recruit row/card displays:

* DQS score (0–100) with color coding: Green (80+), Yellow (60–79), Gray (below 60\)

* “Not Qualified” badge if below any threshold (with hover explanation)

* Data completeness indicator (e.g., “8/12 fields extracted”)

* Quick breakdown tooltip showing component contributions

## **5\. Coach Dashboard**

### **5.1 Recruit Database View**

* Paginated grid/table of all ingested recruit profiles

* Default sort: DQS (highest first)

* “Not Qualified” recruits hidden by default (toggle to show)

* Profile cards display: Name, DQS, Grad Year, Position, Height, GPA, Club Level, Location, Data Completeness, Date Ingested

### **5.2 Filtering**

| Filter | Type | Options |
| :---- | :---- | :---- |
| Graduation Year | Multi-select | 2025–2030 |
| Position | Multi-select | All positions |
| Height (min) | Number input | In inches |
| GPA (min) | Number input | 0.0–4.0 |
| SAT (min) | Number input |  |
| ACT (min) | Number input |  |
| Club Level | Multi-select | MLS Next, ECNL, GA, Regional, Other |
| Location | Text search | City, state, or country |
| Has Video | Checkbox | Only show profiles with highlight video |
| DQS Range | Range slider | Filter by score range |
| Data Completeness | Range slider | Filter by extraction completeness |
| Show Not Qualified | Checkbox | Include recruits below thresholds |
| Needs Review | Checkbox | Show profiles with low-confidence extractions |

### **5.3 Interest Flagging**

* ⭐ “Interested” — appears in a saved list for pipeline tracking

* ❌ “Not a Fit” — hidden from default view (can be shown via filter)

* (No flag) — default state

### **5.4 Recruit Detail View**

Clicking a recruit card opens the full profile view:

* All extracted fields displayed with confidence indicators

* DQS score with full component breakdown

* Original email text viewable (expandable section)

* Highlight video embedded if URL was extracted

* Edit button to manually correct any extracted field

* Coach can flag interest from this view

* One-click copy of recruit email address for outreach

### **5.5 Ingestion Queue**

A secondary view showing recently ingested emails and their processing status:

* “Processed” — profile created/updated successfully

* “Needs Review” — low-confidence extraction, coach should verify

* “Insufficient Data” — email didn’t contain enough recruit info

* “Failed” — processing error (with retry option)

## **6\. Admin Functions**

* Approve/reject coach account requests

* View all coaches, programs, and ingested profiles

* Add/edit programs in the system

* Monitor extraction quality (percentage of emails successfully parsed)

* Adjust default scoring parameters

# **Non-Functional Requirements**

## **Performance**

* Dashboard page load under 2 seconds

* Email ingestion and extraction completes within 30 seconds of Zapier trigger

* Support up to 1,000 recruit profiles per program

## **Security**

* HTTPS required

* API keys for Zapier webhook authentication (per coach)

* Passwords hashed (bcrypt or similar)

* FERPA considerations: recruit academic data only visible to verified coaches

# **Technical Architecture**

## **Frontend**

* Framework: Next.js

* Styling: Tailwind CSS

* Hosting: Vercel

## **Backend**

* Framework: Next.js API routes

* Database: PostgreSQL (Supabase)

* Authentication: Supabase Auth

* AI Extraction: Claude API (Anthropic) for email parsing

## **Integration Layer**

* Zapier: Gmail trigger → Webhook action to platform API

* Ingestion API: POST /api/ingest/email (receives Zapier payloads)

* Async processing queue for extraction and scoring

# **Data Model (Simplified)**

The data model shifts from the original athlete-created profiles to coach-ingested recruit profiles. Key changes: recruits do not have accounts or passwords; profiles are created by the system from email extraction; the original email content is stored for reference.

**recruits**

├── id (uuid, PK)

├── email (unique)

├── full\_name

├── phone

├── graduation\_year

├── current\_school

├── city / state / country

├── positions (text\[\])

├── preferred\_foot

├── height\_inches (int)

├── weight\_lbs (int)

├── gpa (decimal)

├── sat\_score (int)

├── act\_score (int)

├── club\_team

├── club\_level (enum)

├── video\_url

├── extraction\_confidence (jsonb) — per-field confidence

├── fields\_missing (text\[\]) — fields not found in email

├── created\_at

└── updated\_at

**ingested\_emails**

├── id (uuid, PK)

├── coach\_id (FK → coaches)

├── recruit\_id (FK → recruits, nullable)

├── sender\_email

├── subject

├── body\_plain

├── body\_html

├── received\_at

├── processing\_status (enum: pending, processed, needs\_review, insufficient, failed)

├── extracted\_data (jsonb) — raw AI extraction output

└── created\_at

The coaches, programs, program\_config, recruit\_dqs\_scores, and coach\_recruit\_flags tables remain structurally similar to v1, with “athlete” renamed to “recruit” throughout.

# **Success Metrics**

## **Primary (Must Achieve for MVP Success)**

* Coach Adoption: At least 3 coaching staffs actively using the platform weekly

* Ingestion Volume: At least 100 recruit emails processed through the pipeline

* Extraction Quality: 80%+ of ingested emails produce profiles with 6+ fields successfully extracted

* Qualitative Validation: Coaches report saving time vs. manually reading recruit emails

## **Secondary**

* At least 10 “interested” flags created by coaches

* Average coach logs in 2+ times per week during recruiting periods

* Net Promoter Score \> 7 from pilot users

# **Risks and Mitigations**

| Risk | Likelihood | Impact | Mitigation |
| :---- | :---- | :---- | :---- |
| AI extraction quality is too low | Medium | High | Use structured prompting with Claude API; allow manual edits; iterate on extraction prompts based on real emails |
| Coaches don’t adopt due to Zapier setup friction | Medium | High | Provide step-by-step guided setup; consider building direct Gmail integration in Phase 2 |
| Recruit emails lack sufficient data | High | Medium | Flag incomplete profiles clearly; coaches understand data limitations; track which fields are most commonly missing |
| Zapier free tier limits (100 tasks/mo) insufficient | Low | Low | Professional plan at $20/mo covers 750 tasks; coaches can be selective about which emails to label |
| Competitors copy approach | Low | Medium | Speed to market; leverage Spencer’s network; email ingestion \+ AI extraction is a defensible UX moat |
| Data privacy concerns with email content | Medium | High | Clear terms of service; coaches control what’s ingested; FERPA-conscious design; original emails encrypted at rest |

# **Timeline (Estimated)**

| Phase | Duration | Deliverables |
| :---- | :---- | :---- |
| Design & Planning | 1 week | Wireframes, data model, scoring formula finalization, Zapier integration design, extraction prompt engineering |
| Core Infrastructure | 1–2 weeks | Auth, database setup, coach accounts, program configuration, Zapier webhook endpoint |
| AI Extraction Pipeline | 1–2 weeks | Email ingestion API, Claude API integration, extraction prompt tuning, deduplication logic, confidence scoring |
| Scoring System | 1 week | DQS calculation engine with configurable weights, missing data handling, score display |
| Coach Dashboard | 1–2 weeks | Dashboard with filtering/sorting, profile cards, detail views, interest flagging, ingestion queue |
| Pilot Onboarding | 1–2 weeks | Onboard Amherst coaches, process first batch of real recruit emails, iterate on extraction quality |

**Target: Functional MVP in 6–8 weeks from project start.**

# **Open Questions**

* Zapier vs. Direct Gmail API: Should we use Zapier for MVP speed and migrate to a direct Gmail API integration later for a more seamless experience?

* Extraction Prompt Strategy: Should we use a single extraction call per email, or a multi-pass approach (first extract, then validate/enrich)?

* Weight Input Method: Tier system (Critical/High/Medium/Low) or point allocation (distribute 100 points)?

* Missing Data Scoring: How aggressively should completeness penalty affect DQS? A recruit with only 4 fields extracted shouldn’t score higher than one with 10 fields just because the 4 fields are strong.

* Multi-Coach Email Sharing: If multiple coaches ingest the same recruit (same email address), should they share a profile or each have their own copy?

* Club Level Tiers: Are the proposed scores (MLS Next \= 100, ECNL \= 90, GA \= 75, Regional \= 55, Other \= 35\) accurate? Need Spencer’s validation.

* Branding: Keep “The Recruiting Score AI” given that the MVP now uses AI for extraction (even though scoring is formula-based)?

# **Appendix: User Stories**

**Coach Stories**

* As a coach, I want to move a recruit email to a folder and have it automatically appear as a scored profile in my dashboard, so I don’t have to manually enter data.

* As a coach, I want to set my program’s academic and athletic requirements so that recruits are automatically scored against my priorities.

* As a coach, I want to see recruits sorted by their fit for my program so I can focus on the best matches first.

* As a coach, I want to filter recruits by position, grad year, and other criteria to narrow my search.

* As a coach, I want to see which fields were confidently extracted and which need manual review, so I can trust the data.

* As a coach, I want to edit extracted profile data when the AI got something wrong.

* As a coach, I want to flag recruits I’m interested in to track my recruiting pipeline.

* As a coach, I want to see the original email alongside the extracted profile so I can verify information in context.