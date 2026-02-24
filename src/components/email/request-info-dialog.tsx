"use client";

import { useState, useCallback, useEffect } from "react";
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

interface RequestInfoDialogProps {
  open: boolean;
  onClose: () => void;
  recruitId: string;
  recruitName: string | null;
  recruitEmail: string | null;
  selectedFields: string[];
  fieldLabels: Record<string, string>;
  coachEmail?: string;
}

export function RequestInfoDialog({
  open,
  onClose,
  recruitId,
  recruitName,
  recruitEmail,
  selectedFields,
  fieldLabels,
  coachEmail,
}: RequestInfoDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDraft = useCallback(async () => {
    if (selectedFields.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft/request-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruitId, fields: selectedFields }),
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
  }, [recruitId, selectedFields]);

  useEffect(() => {
    if (open && selectedFields.length > 0) {
      fetchDraft();
    }
  }, [open, fetchDraft, selectedFields.length]);

  function handleClose() {
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
      authuser: coachEmail,
    });
    logAndOpen("gmail", url);
  }

  function handleOutlook() {
    const url = buildOutlookComposeUrl({
      to: recruitEmail ?? undefined,
      subject,
      body,
      authuser: coachEmail,
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

  const fieldSummary = selectedFields
    .map((f) => fieldLabels[f] ?? f)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Request Info from {recruitName ?? "Recruit"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Requesting: {fieldSummary}
          </p>
        </DialogHeader>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating personalized draft...
            </p>
          </div>
        )}

        {/* Compose — ready */}
        {!loading && (
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
              <Label htmlFor="ri-subject">Subject</Label>
              <Input
                id="ri-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ri-body">Message</Label>
              <Textarea
                id="ri-body"
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
                onClick={fetchDraft}
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
