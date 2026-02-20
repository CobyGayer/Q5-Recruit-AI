"use client";

import { useState, useCallback } from "react";
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
} from "@/lib/email/compose";
import { Mail, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import type { EmailMethod } from "@/types/database";

interface EmailComposeDialogProps {
  open: boolean;
  onClose: () => void;
  recruitId: string;
  recruitName: string | null;
  recruitEmail: string | null;
}

type Step = "prompt" | "compose";

export function EmailComposeDialog({
  open,
  onClose,
  recruitId,
  recruitName,
  recruitEmail,
}: EmailComposeDialogProps) {
  const [step, setStep] = useState<Step>("prompt");
  const [purpose, setPurpose] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDraft = useCallback(
    async (purposeText?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/email/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recruitId,
            ...(purposeText ? { purpose: purposeText } : {}),
          }),
        });
        if (!res.ok) {
          throw new Error("Failed to generate draft");
        }
        const data = await res.json();
        setSubject(data.subject);
        setBody(data.body);
      } catch {
        setError(
          "Failed to generate email draft. You can write your own below."
        );
        setSubject("");
        setBody("");
      } finally {
        setLoading(false);
      }
    },
    [recruitId]
  );

  function handleGenerateDraft() {
    setStep("compose");
    fetchDraft(purpose.trim() || undefined);
  }

  function handleSkip() {
    setSubject("");
    setBody("");
    setError(null);
    setStep("compose");
  }

  function handleClose() {
    setStep("prompt");
    setPurpose("");
    setSubject("");
    setBody("");
    setError(null);
    setCopied(false);
    onClose();
  }

  function logAndOpen(method: EmailMethod, url: string) {
    fetch("/api/email/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruitId, subject, body, method }),
    }).catch(() => {});

    window.open(url, "_blank");
    handleClose();
  }

  function handleGmail() {
    const url = buildGmailComposeUrl({
      to: recruitEmail ?? undefined,
      subject,
      body,
    });
    logAndOpen("gmail", url);
  }

  function handleOutlook() {
    const url = buildOutlookComposeUrl({
      to: recruitEmail ?? undefined,
      subject,
      body,
    });
    logAndOpen("outlook", url);
  }

  function handleMailto() {
    const url = buildMailtoUrl({
      to: recruitEmail ?? undefined,
      subject,
      body,
    });
    fetch("/api/email/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruitId, subject, body, method: "mailto" }),
    }).catch(() => {});

    window.location.href = url;
    handleClose();
  }

  function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);

    fetch("/api/email/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recruitId,
        subject,
        body,
        method: "clipboard",
      }),
    }).catch(() => {});

    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email {recruitName ?? "Recruit"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Purpose prompt */}
        {step === "prompt" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-purpose">
                What is this email about?
              </Label>
              <Input
                id="email-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder='e.g., "Interested in your highlight reel", "Camp invite on March 15th"'
                onKeyDown={(e) => {
                  if (e.key === "Enter" && purpose.trim()) {
                    handleGenerateDraft();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                The AI will generate a personalized email based on this and the
                recruit&apos;s profile data.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleGenerateDraft}
                disabled={!purpose.trim()}
              >
                Generate Draft
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip &mdash; I&apos;ll write my own
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Compose — loading */}
        {step === "compose" && loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating personalized draft...
            </p>
          </div>
        )}

        {/* Step 2: Compose — ready */}
        {step === "compose" && !loading && (
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-8">To:</span>
              <span className="text-sm">
                {recruitEmail ?? "No email on file"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email..."
                rows={12}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDraft(purpose.trim() || undefined)}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Regenerate
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Open in your email client to send from your own address:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGmail} disabled={!recruitEmail}>
                  Open in Gmail
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOutlook}
                  disabled={!recruitEmail}
                >
                  Open in Outlook
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMailto}
                  disabled={!recruitEmail}
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
      </DialogContent>
    </Dialog>
  );
}
