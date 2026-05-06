"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronDown, ChevronUp, Mail, Copy, X, Settings2 } from "lucide-react";
import { MISSING_FIELD_LABELS, TEMPLATE_TOKEN_KEYS } from "@/lib/email/draft";
import { buildGmailComposeUrl, buildOutlookComposeUrl } from "@/lib/email/compose";

interface QueueRecruit {
  id: string;
  full_name: string | null;
  email: string | null;
  graduation_year: number | null;
  positions: string[];
  current_school: string | null;
  club_team: string | null;
  gpa: number | null;
  fields_missing: string[];
  fields_extracted: number;
  fields_total: number;
  club_level: string | null;
}

interface QueueItem {
  id: string;
  recruit_id: string;
  queued_at: string;
  missing_fields_snapshot: string[];
  recruit: QueueRecruit;
  effective_missing_fields: string[];
  pre_filled_subject: string;
  pre_filled_body: string;
}

function MissingFieldsBadges({ fields }: { fields: string[] }) {
  const seen = new Set<string>();
  const deduped = fields.filter((f) => {
    const label = MISSING_FIELD_LABELS[f] ?? f;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {deduped.map((f) => (
        <Badge
          key={f}
          variant="outline"
          className="text-xs"
        >
          {MISSING_FIELD_LABELS[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}

function MissingFieldsQueueCard({
  item,
  onRemoved,
  onError,
}: {
  item: QueueItem;
  onRemoved: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editedSubject, setEditedSubject] = useState(item.pre_filled_subject);
  const [editedBody, setEditedBody] = useState(item.pre_filled_body);
  const [copied, setCopied] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    setEditedSubject(item.pre_filled_subject);
    setEditedBody(item.pre_filled_body);
  }, [item.pre_filled_subject, item.pre_filled_body]);

  function handleExpand() {
    setExpanded((v) => !v);
  }

  async function handleSend(method: "gmail" | "outlook") {
    const subject = editedSubject;
    const body = editedBody;

    const url =
      method === "gmail"
        ? buildGmailComposeUrl({ to: item.recruit.email ?? undefined, subject, body })
        : buildOutlookComposeUrl({ to: item.recruit.email ?? undefined, subject, body });

    window.open(url, "_blank");

    setActionPending(true);
    try {
      const res = await fetch("/api/recruits/missing-fields-queue/mark-requested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: item.id, subject, body, method }),
      });

      if (!res.ok) {
        onError("Failed to record the email send. If you already sent it, you can safely try again — it won't duplicate.");
        return;
      }

      onRemoved(item.id);
    } finally {
      setActionPending(false);
    }
  }

  async function handleCopy() {
    const subject = editedSubject;
    const body = editedBody;

    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    } catch {
      onError("Failed to copy email. Please copy it manually.");
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    setActionPending(true);
    try {
      const res = await fetch("/api/recruits/missing-fields-queue/mark-requested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: item.id, subject, body, method: "clipboard" }),
      });

      if (!res.ok) {
        onError("Email copied. Failed to record it — please note it was sent manually.");
        return;
      }

      onRemoved(item.id);
    } finally {
      setActionPending(false);
    }
  }

  async function handleDismiss() {
    setActionPending(true);
    try {
      const res = await fetch("/api/recruits/missing-fields-queue/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: item.id }),
      });

      if (!res.ok) {
        onError("Failed to dismiss. Please try again.");
        return;
      }

      onRemoved(item.id);
    } finally {
      setActionPending(false);
    }
  }

  const recruit = item.recruit;
  const queuedDate = new Date(item.queued_at).toLocaleDateString();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{recruit.full_name || "Unknown Name"}</p>
            {recruit.email && (
              <p className="text-xs text-muted-foreground mt-0.5">{recruit.email}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {recruit.graduation_year && (
                <Badge variant="outline" className="text-xs">
                  Class of {recruit.graduation_year}
                </Badge>
              )}
              {recruit.positions?.map((pos) => (
                <Badge key={pos} variant="outline" className="text-xs border-primary/30 text-primary">
                  {pos}
                </Badge>
              ))}
              {recruit.current_school && (
                <Badge variant="outline" className="text-xs bg-muted">
                  {recruit.current_school}
                </Badge>
              )}
              {recruit.club_team && (
                <Badge variant="outline" className="text-xs">
                  {recruit.club_team}
                </Badge>
              )}
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground font-medium">Missing info:</p>
              <MissingFieldsBadges fields={item.effective_missing_fields} />
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2">Queued {queuedDate}</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleExpand}
              disabled={actionPending}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide Email
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Review Email
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-xs"
              onClick={handleDismiss}
              disabled={actionPending}
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Subject
              </label>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Body
              </label>
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={10}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleSend("gmail")}
                disabled={actionPending}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Open in Gmail
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSend("outlook")}
                disabled={actionPending}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Open in Outlook
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                disabled={actionPending}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied ? "Copied!" : "Copy Text"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TOKEN_LABELS: Record<string, string> = {
  "{{recruit_name}}":        "Recruit Name",
  "{{missing_fields_list}}": "Missing Fields",
  "{{coach_name}}":          "Coach Name",
  "{{program_name}}":        "Program Name",
  "{{institution}}":         "Institution",
};

const TOKENS = TEMPLATE_TOKEN_KEYS.map((token) => ({ token, label: TOKEN_LABELS[token] }));

const PREVIEW_SAMPLE = {
  "{{recruit_name}}": "Alex",
  "{{missing_fields_list}}": "• GPA\n• highlight video link",
  "{{coach_name}}": "Coach",
  "{{program_name}}": "Your Program",
  "{{institution}}": "Your University",
};

function previewRender(template: string): string {
  return Object.entries(PREVIEW_SAMPLE).reduce(
    (text, [token, val]) => text.replaceAll(token, val),
    template
  );
}

const DEFAULT_SUBJECT_PLACEHOLDER = "Quick Question from {{coach_name}} at {{institution}}";
const DEFAULT_BODY_PLACEHOLDER = `Hi {{recruit_name}},

Thank you for reaching out about {{program_name}} at {{institution}}! We're excited to learn more about you.

To complete your recruitment profile, we just need a few more details. Could you please reply with the following?

{{missing_fields_list}}

Once we have this information, we'll be able to give your profile a full review.

Looking forward to hearing from you!

{{coach_name}}
{{program_name}} | {{institution}}`;

function TemplateEditorDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"subject" | "body">("body");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaveError(null);
    setLoadError(false);
    fetch("/api/coaches/email-template")
      .then((r) => {
        if (!r.ok) throw new Error("server error");
        return r.json();
      })
      .then((data) => {
        setSubject(data.missing_fields_email_subject ?? "");
        setBody(data.missing_fields_email_body ?? "");
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  function insertToken(token: string) {
    if (lastFocusedField.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }
  }

  async function handleSave() {
    const knownTokens: Set<string> = new Set(TOKENS.map((t) => t.token));
    const allUnknown = [
      ...(subject.match(/\{\{[^}]+\}\}/g) ?? []),
      ...(body.match(/\{\{[^}]+\}\}/g) ?? []),
    ].filter((t) => !knownTokens.has(t));
    const uniqueUnknown = [...new Set(allUnknown)];
    if (uniqueUnknown.length > 0) {
      setSaveError(`Unknown tokens found — remove them before saving: ${uniqueUnknown.join(", ")}`);
      return;
    }
    if (body.trim() && !body.includes("{{missing_fields_list}}")) {
      setSaveError("Body template must include {{missing_fields_list}} so recruits know what to send.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/coaches/email-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missing_fields_email_subject: subject.trim() || null,
          missing_fields_email_body: body.trim() || null,
        }),
      });
      if (!res.ok) {
        setSaveError("Failed to save template. Please try again.");
        return;
      }
      await onSaved();
      onOpenChange(false);
    } catch {
      setSaveError("Failed to save template. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSubject("");
    setBody("");
    setSaveError(null);
  }

  const previewSubject = subject.trim()
    ? previewRender(subject)
    : previewRender(DEFAULT_SUBJECT_PLACEHOLDER);
  const previewBody = body.trim()
    ? previewRender(body)
    : previewRender(DEFAULT_BODY_PLACEHOLDER);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Email Template</DialogTitle>
          <DialogDescription>
            Edit the template used when requesting missing profile info. Use tokens to insert
            recruit-specific content. Leave blank to use the built-in default.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Insert token</p>
              <div className="flex flex-wrap gap-1.5">
                {TOKENS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="text-xs px-2 py-1 rounded border border-input bg-muted hover:bg-accent font-mono"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="template-subject" className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
              <input
                id="template-subject"
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => { lastFocusedField.current = "subject"; }}
                placeholder={DEFAULT_SUBJECT_PLACEHOLDER}
                disabled={loadError}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="template-body" className="text-xs font-medium text-muted-foreground block mb-1">Body</label>
              <textarea
                id="template-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => { lastFocusedField.current = "body"; }}
                placeholder={DEFAULT_BODY_PLACEHOLDER}
                rows={10}
                disabled={loadError}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono disabled:opacity-50"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Preview</p>
              <div className="rounded border border-input bg-muted/30 p-3 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Subject: {previewSubject}</p>
                <pre className="text-xs whitespace-pre-wrap font-sans mt-2">{previewBody}</pre>
              </div>
            </div>

            {loadError && (
              <p className="text-xs text-rose-600">Failed to load saved template.</p>
            )}
            {saveError && (
              <p className="text-xs text-rose-600">{saveError}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || loadError}>
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MissingFieldsQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const refreshItems = useCallback(async () => {
    try {
      const res = await fetch("/api/recruits/missing-fields-queue");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data);
    } catch { /* silent */ }
  }, []);

  const loadItems = useCallback(async () => {
    setPageLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/recruits/missing-fields-queue");
      if (!res.ok) throw new Error("Failed to load queue");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleRemoved(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Missing Profile Info</h1>
          <Badge variant="secondary" className="text-xs font-medium">Beta</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-muted-foreground"
            onClick={() => setTemplateOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Customize Template
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          These recruits are missing profile information. Review the pre-filled email for each
          recruit, edit if needed, then send it to request the missing details. Each recruit will
          only be asked once.
        </p>
      </div>

      <TemplateEditorDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onSaved={refreshItems}
      />

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading queue...</p>
        </div>
      ) : !errorMsg && items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No recruits are missing profile info. You&apos;re all caught up!
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : !errorMsg ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {items.length} recruit{items.length !== 1 ? "s" : ""} pending
          </p>
          {items.map((item) => (
            <MissingFieldsQueueCard
              key={item.id}
              item={item}
              onRemoved={handleRemoved}
              onError={setErrorMsg}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
