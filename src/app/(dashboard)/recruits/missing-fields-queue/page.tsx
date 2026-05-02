"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronUp, Mail, Copy, X } from "lucide-react";
import { MISSING_FIELD_LABELS } from "@/lib/email/draft";
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
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {fields.map((f) => (
        <Badge
          key={f}
          variant="outline"
          className="text-xs bg-blue-50 border-blue-200 text-blue-700"
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
  const [initialized, setInitialized] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  function handleExpand() {
    if (!initialized) {
      setEditedSubject(item.pre_filled_subject);
      setEditedBody(item.pre_filled_body);
      setInitialized(true);
    }
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
    <Card className="border-blue-200">
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
              className="border-blue-300 text-blue-800 hover:bg-blue-50 text-xs"
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

export default function MissingFieldsQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        <h1 className="text-2xl font-bold">Missing Profile Info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These recruits are missing profile information. Review the pre-filled email for each
          recruit, edit if needed, then send it to request the missing details. Each recruit will
          only be asked once.
        </p>
      </div>

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
