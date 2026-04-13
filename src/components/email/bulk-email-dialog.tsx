"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  buildGmailComposeUrl,
  buildOutlookComposeUrl,
  buildMailtoUrl,
  estimateComposeUrlLength,
  MAILTO_MAX_LENGTH,
} from "@/lib/email/compose";
import {
  Mail,
  Copy,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Users,
} from "lucide-react";
import type { RecruitWithScore, EmailMethod } from "@/types/database";

type BulkMode = "choose" | "announcement" | "personalized";
type AnnStep = "prompt" | "compose";
type PersStep = "prompt" | "compose";

interface BulkEmailDialogProps {
  open: boolean;
  onClose: () => void;
  selectedRecruits: RecruitWithScore[];
  coachEmail?: string;
}

interface PersonalizedDraft {
  recruitId: string;
  recruitName: string;
  recruitEmail: string | null;
  subject: string;
  body: string;
}

export function BulkEmailDialog({
  open,
  onClose,
  selectedRecruits,
  coachEmail,
}: BulkEmailDialogProps) {
  const isMultiple = selectedRecruits.length > 1;
  const [mode, setMode] = useState<BulkMode>(
    isMultiple ? "choose" : "personalized",
  );

  // Announcement state
  const [annStep, setAnnStep] = useState<AnnStep>("prompt");
  const [annPurpose, setAnnPurpose] = useState("");
  const [annSubject, setAnnSubject] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annBccEmails, setAnnBccEmails] = useState<string[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  // Personalized state
  const [persStep, setPersStep] = useState<PersStep>("prompt");
  const [persPurpose, setPersPurpose] = useState("");
  const [drafts, setDrafts] = useState<PersonalizedDraft[]>([]);
  const [currentDraftIdx, setCurrentDraftIdx] = useState(0);
  const [persLoading, setPersLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setMode(isMultiple ? "choose" : "personalized");
    setAnnStep("prompt");
    setAnnPurpose("");
    setAnnSubject("");
    setAnnBody("");
    setAnnBccEmails([]);
    setAnnLoading(false);
    setPersStep("prompt");
    setPersPurpose("");
    setDrafts([]);
    setCurrentDraftIdx(0);
    setPersLoading(false);
    setCopied(false);
    setError(null);
  }, [isMultiple]);

  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, resetState]);

  function resetAndClose() {
    resetState();
    onClose();
  }

  function logEmail(
    recruitIds: string[],
    subject: string,
    body: string,
    method: EmailMethod,
  ) {
    fetch("/api/email/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruitIds, subject, body, method }),
    }).catch(() => {});
  }

  // ── Announcement ──

  async function generateAnnouncement() {
    setAnnLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruitIds: selectedRecruits.map((r) => r.id),
          purpose: annPurpose,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate announcement");
      const data = await res.json();
      setAnnSubject(data.subject);
      setAnnBody(data.body);
      setAnnBccEmails(data.bccEmails);
      setAnnStep("compose");
    } catch {
      setError("Failed to generate announcement. Please try again.");
    } finally {
      setAnnLoading(false);
    }
  }

  function handleAnnSkip() {
    const emails = selectedRecruits
      .map((r) => r.email)
      .filter(Boolean) as string[];
    setAnnBccEmails(emails);
    setAnnSubject("");
    setAnnBody("");
    setError(null);
    setAnnStep("compose");
  }

  function handleAnnGmail() {
    const url = buildGmailComposeUrl({
      bcc: annBccEmails,
      subject: annSubject,
      body: annBody,
      authuser: coachEmail,
    });
    logEmail(
      selectedRecruits.map((r) => r.id),
      annSubject,
      annBody,
      "gmail",
    );
    window.open(url, "_blank");
    resetAndClose();
  }

  function handleAnnOutlook() {
    const url = buildOutlookComposeUrl({
      bcc: annBccEmails,
      subject: annSubject,
      body: annBody,
      authuser: coachEmail,
    });
    logEmail(
      selectedRecruits.map((r) => r.id),
      annSubject,
      annBody,
      "outlook",
    );
    window.open(url, "_blank");
    resetAndClose();
  }

  function handleAnnMailto() {
    const url = buildMailtoUrl({
      bcc: annBccEmails,
      subject: annSubject,
      body: annBody,
    });
    logEmail(
      selectedRecruits.map((r) => r.id),
      annSubject,
      annBody,
      "mailto",
    );
    window.location.href = url;
    resetAndClose();
  }

  const annMailtoTooLong =
    annStep === "compose" &&
    estimateComposeUrlLength({
      bcc: annBccEmails,
      subject: annSubject,
      body: annBody,
    }) > MAILTO_MAX_LENGTH;

  // ── Personalized ──

  const recruitsWithEmail = selectedRecruits.filter((r) => r.email);

  async function generatePersonalized() {
    setPersLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruitIds: selectedRecruits.map((r) => r.id),
          ...(persPurpose.trim() ? { purpose: persPurpose.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to generate drafts");
      const data = await res.json();
      const mappedDrafts: PersonalizedDraft[] = data.drafts.map(
        (d: { recruitId: string; subject: string; body: string }) => {
          const recruit = selectedRecruits.find((r) => r.id === d.recruitId);
          return {
            ...d,
            recruitName: recruit?.full_name ?? "Unknown",
            recruitEmail: recruit?.email ?? null,
          };
        },
      );
      setDrafts(mappedDrafts);
      setCurrentDraftIdx(0);
      setPersStep("compose");
    } catch {
      setError("Failed to generate personalized drafts. Please try again.");
    } finally {
      setPersLoading(false);
    }
  }

  function handlePersSkip() {
    const mappedDrafts: PersonalizedDraft[] = recruitsWithEmail.map((r) => ({
      recruitId: r.id,
      recruitName: r.full_name ?? "Unknown",
      recruitEmail: r.email,
      subject: "",
      body: "",
    }));
    setDrafts(mappedDrafts);
    setCurrentDraftIdx(0);
    setError(null);
    setPersStep("compose");
  }

  function openCurrentDraft(method: EmailMethod) {
    const draft = drafts[currentDraftIdx];
    if (!draft) return;

    let url: string;
    if (method === "gmail") {
      url = buildGmailComposeUrl({
        to: draft.recruitEmail ?? undefined,
        subject: draft.subject,
        body: draft.body,
        authuser: coachEmail,
      });
    } else if (method === "outlook") {
      url = buildOutlookComposeUrl({
        to: draft.recruitEmail ?? undefined,
        subject: draft.subject,
        body: draft.body,
        authuser: coachEmail,
      });
    } else {
      url = buildMailtoUrl({
        to: draft.recruitEmail ?? undefined,
        subject: draft.subject,
        body: draft.body,
      });
    }

    logEmail([draft.recruitId], draft.subject, draft.body, method);

    if (method === "mailto") {
      window.location.href = url;
    } else {
      window.open(url, "_blank");
    }

    // Advance to next draft or close
    if (currentDraftIdx < drafts.length - 1) {
      setCurrentDraftIdx(currentDraftIdx + 1);
    } else {
      resetAndClose();
    }
  }

  function updateCurrentDraft(field: "subject" | "body", value: string) {
    setDrafts((prev) => {
      const updated = [...prev];
      updated[currentDraftIdx] = {
        ...updated[currentDraftIdx],
        [field]: value,
      };
      return updated;
    });
  }

  function handleCopy() {
    let text: string;
    if (mode === "announcement") {
      text = `Subject: ${annSubject}\n\n${annBody}`;
    } else if (drafts[currentDraftIdx]) {
      const d = drafts[currentDraftIdx];
      text = `To: ${d.recruitEmail}\nSubject: ${d.subject}\n\n${d.body}`;
    } else {
      return;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email {selectedRecruits.length} Recruit
            {selectedRecruits.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Mode chooser — only shown when multiple recruits selected */}
        {mode === "choose" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {recruitsWithEmail.length} of {selectedRecruits.length} selected
              recruits have email addresses.
            </p>

            <button
              className="w-full text-left border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
              onClick={() => setMode("announcement")}
            >
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Send Announcement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One email to everyone (BCC). Great for camp invites,
                    questionnaires, program updates.
                  </p>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
              onClick={() => setMode("personalized")}
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">Personalized Outreach</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unique AI-generated email per recruit using their profile
                    data. Opens one at a time.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── Announcement: purpose prompt ── */}
        {mode === "announcement" && annStep === "prompt" && (
          <div className="space-y-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {error && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ann-purpose">What is this email about?</Label>
              <Input
                id="ann-purpose"
                value={annPurpose}
                onChange={(e) => setAnnPurpose(e.target.value)}
                placeholder='e.g., "Prospect camp on March 15th", "Recruiting questionnaire"'
                onKeyDown={(e) => {
                  if (e.key === "Enter" && annPurpose.trim()) {
                    generateAnnouncement();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                The AI will generate an appropriate email based on this.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={generateAnnouncement}
                disabled={!annPurpose.trim() || annLoading}
              >
                {annLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Draft"
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleAnnSkip}>
                Skip &mdash; I&apos;ll write my own
              </Button>
            </div>
          </div>
        )}

        {/* ── Announcement: compose ── */}
        {mode === "announcement" && annStep === "compose" && (
          <div className="space-y-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnnStep("prompt");
                setAnnSubject("");
                setAnnBody("");
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {error && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-10">BCC:</span>
              <span className="text-sm text-muted-foreground">
                {annBccEmails.length} recipients
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-subject">Subject</Label>
              <Input
                id="ann-subject"
                value={annSubject}
                onChange={(e) => setAnnSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Message</Label>
              <Textarea
                id="ann-body"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                rows={10}
                className="min-h-[180px] font-mono text-sm"
                placeholder="Write your email..."
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Opens your email client with all {annBccEmails.length} recruits
                BCC&apos;d:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAnnGmail}>Open in Gmail</Button>
                <Button variant="outline" onClick={handleAnnOutlook}>
                  Open in Outlook
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAnnMailto}
                  disabled={annMailtoTooLong}
                  title={
                    annMailtoTooLong
                      ? "Too many recipients for mailto link"
                      : undefined
                  }
                >
                  Open in Mail App
                </Button>
                <Button variant="ghost" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Personalized: purpose prompt ── */}
        {mode === "personalized" && persStep === "prompt" && !persLoading && (
          <div className="space-y-4 py-2">
            {isMultiple && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("choose")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            {error && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              {recruitsWithEmail.length} of {selectedRecruits.length} selected
              recruit{selectedRecruits.length !== 1 ? "s" : ""} ha
              {recruitsWithEmail.length === 1 ? "s" : "ve"} an email address.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="pers-purpose">What is this email about?</Label>
              <Input
                id="pers-purpose"
                value={persPurpose}
                onChange={(e) => setPersPurpose(e.target.value)}
                placeholder='e.g., "Initial outreach — expressing interest", "Following up after showcase"'
                onKeyDown={(e) => {
                  if (e.key === "Enter" && persPurpose.trim()) {
                    generatePersonalized();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Each email will be uniquely personalized using the
                recruit&apos;s profile data (GPA, position, club team, etc.).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={generatePersonalized}
                disabled={
                  !persPurpose.trim() ||
                  persLoading ||
                  recruitsWithEmail.length === 0
                }
              >
                {`Generate ${recruitsWithEmail.length} Personalized Draft${recruitsWithEmail.length !== 1 ? "s" : ""}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePersSkip}>
                Skip &mdash; I&apos;ll write my own
              </Button>
            </div>
          </div>
        )}

        {/* ── Personalized: loading ── */}
        {mode === "personalized" && persLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating {recruitsWithEmail.length} personalized draft
              {recruitsWithEmail.length !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {/* ── Personalized: compose per recruit ── */}
        {mode === "personalized" &&
          persStep === "compose" &&
          !persLoading &&
          drafts.length > 0 && (
            <div className="space-y-4 py-2">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCurrentDraftIdx(Math.max(0, currentDraftIdx - 1))
                  }
                  disabled={currentDraftIdx === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentDraftIdx + 1} of {drafts.length}:{" "}
                  <span className="font-medium text-foreground">
                    {drafts[currentDraftIdx].recruitName}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCurrentDraftIdx(
                      Math.min(drafts.length - 1, currentDraftIdx + 1),
                    )
                  }
                  disabled={currentDraftIdx === drafts.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-8">To:</span>
                <span className="text-sm">
                  {drafts[currentDraftIdx].recruitEmail ?? "No email"}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pers-subject">Subject</Label>
                <Input
                  id="pers-subject"
                  value={drafts[currentDraftIdx].subject}
                  onChange={(e) =>
                    updateCurrentDraft("subject", e.target.value)
                  }
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pers-body">Message</Label>
                <Textarea
                  id="pers-body"
                  value={drafts[currentDraftIdx].body}
                  onChange={(e) => updateCurrentDraft("body", e.target.value)}
                  rows={10}
                  className="min-h-[180px] font-mono text-sm"
                  placeholder="Write your email..."
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Send this email, then{" "}
                  {currentDraftIdx < drafts.length - 1
                    ? "review the next draft"
                    : "you're done"}
                  :
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => openCurrentDraft("gmail")}
                    disabled={!drafts[currentDraftIdx].recruitEmail}
                  >
                    Open in Gmail
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openCurrentDraft("outlook")}
                    disabled={!drafts[currentDraftIdx].recruitEmail}
                  >
                    Open in Outlook
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openCurrentDraft("mailto")}
                    disabled={!drafts[currentDraftIdx].recruitEmail}
                  >
                    Mail App
                  </Button>
                  <Button variant="ghost" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 mr-1.5" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1.5" />
                    )}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
