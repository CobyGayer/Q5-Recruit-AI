"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, GitMerge, X } from "lucide-react";
import type { Recruit } from "@/types/database";
import { buildMergedPayload, chooseSurvivor } from "@/lib/recruits/merge-payload";

interface RecruitEmail {
  id: string;
  sender_email: string | null;
  subject: string | null;
  received_at: string | null;
  body_snippet: string | null;
}

interface ReviewGroupMember extends Recruit {
  recruit_emails: RecruitEmail[];
}

interface ReviewGroup {
  id: string;
  program_id: string;
  name_key: string;
  status: string;
  source: string;
  created_at: string;
  members: ReviewGroupMember[];
}

function RecruitSummaryCard({
  recruit,
  selected,
  onToggle,
}: {
  recruit: ReviewGroupMember;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  function toggleEmail(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="mt-0.5"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{recruit.full_name || "Unknown Name"}</p>
          {recruit.email && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground/70">Email:</span> {recruit.email}
            </p>
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
          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 mt-2 text-xs text-muted-foreground">
            {recruit.gpa != null && <span>Unweighted GPA {recruit.gpa}</span>}
            {recruit.sat_score != null && <span>SAT {recruit.sat_score}</span>}
            {recruit.act_score != null && <span>ACT {recruit.act_score}</span>}
            {recruit.city && recruit.state && <span>{recruit.city}, {recruit.state}</span>}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2">
            Added {new Date(recruit.created_at).toLocaleDateString()}
          </p>
          {(recruit.recruit_emails ?? []).length > 0 && (
            <div className="mt-3 border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Emails ({recruit.recruit_emails.length})
              </p>
              {recruit.recruit_emails.map((email) => {
                const expanded = expandedEmails.has(email.id);
                return (
                  <div key={email.id} className="text-xs rounded bg-muted/50 px-2 py-1.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{email.subject || "(no subject)"}</span>
                      {email.received_at && (
                        <span className="text-muted-foreground shrink-0">
                          {new Date(email.received_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {email.sender_email && (
                      <p className="text-muted-foreground">From: {email.sender_email}</p>
                    )}
                    {email.body_snippet && (
                      <>
                        <p className={`text-muted-foreground/80 whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>
                          {email.body_snippet}
                        </p>
                        <button
                          className="text-primary hover:underline mt-0.5"
                          onClick={(e) => toggleEmail(email.id, e)}
                        >
                          {expanded ? "Show less" : "Show more"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewGroupCard({
  group,
  onMerge,
  onDismiss,
  loading,
}: {
  group: ReviewGroup;
  onMerge: (groupId: string, selectedIds: string[]) => Promise<void>;
  onDismiss: (groupId: string) => Promise<void>;
  loading: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmMergeOpen, setConfirmMergeOpen] = useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);

  // Reset selection when members list changes (e.g. after partial merge)
  const prevMemberIds = useRef<string>("");
  useEffect(() => {
    const currentIds = group.members.map((r) => r.id).sort().join(",");
    if (prevMemberIds.current && prevMemberIds.current !== currentIds) {
      setSelectedIds(new Set());
    }
    prevMemberIds.current = currentIds;
  }, [group.members]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canMerge = selectedIds.size >= 2;

  const selectedRecruits = group.members.filter((r) => selectedIds.has(r.id));
  const mergePreview = canMerge ? buildMergedPayload(selectedRecruits) : null;
  const mergesurvivor = canMerge ? chooseSurvivor(selectedRecruits) : null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              &ldquo;{group.name_key}&rdquo;
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {group.members.length} profiles with this name · Source: {group.source.replaceAll("_", " ")}
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700 shrink-0">
            Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Select 2 or more profiles to merge them into one. You can merge a subset and revisit the
          rest, or dismiss without merging.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {group.members.map((recruit) => (
            <RecruitSummaryCard
              key={recruit.id}
              recruit={recruit}
              selected={selectedIds.has(recruit.id)}
              onToggle={() => toggleSelect(recruit.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            disabled={!canMerge || loading}
            onClick={() => setConfirmMergeOpen(true)}
          >
            <GitMerge className="h-4 w-4 mr-1" />
            Merge Selected ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-muted-foreground"
            disabled={loading}
            onClick={() => setConfirmDismissOpen(true)}
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss Group
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          )}
        </div>
      </CardContent>

      {/* Merge confirmation */}
      <Dialog open={confirmMergeOpen} onOpenChange={setConfirmMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge {selectedIds.size} Profiles?</DialogTitle>
            <DialogDescription>
              The selected profiles will be merged into one recruit record. This action
              cannot be undone. All source emails and history will be preserved.
            </DialogDescription>
          </DialogHeader>
          {mergePreview && mergesurvivor && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Merged profile preview
              </p>
              <div>
                <p className="font-semibold">{mergePreview.full_name ?? mergesurvivor.full_name ?? "Unknown Name"}</p>
                {mergePreview.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground/70">Email:</span> {mergePreview.email}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {mergePreview.graduation_year && (
                  <Badge variant="outline" className="text-xs">Class of {mergePreview.graduation_year}</Badge>
                )}
                {mergePreview.positions?.map((pos) => (
                  <Badge key={pos} variant="outline" className="text-xs border-primary/30 text-primary">{pos}</Badge>
                ))}
                {mergePreview.current_school && (
                  <Badge variant="outline" className="text-xs bg-muted">{mergePreview.current_school}</Badge>
                )}
                {mergePreview.club_team && (
                  <Badge variant="outline" className="text-xs">{mergePreview.club_team}</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {mergePreview.gpa != null && <span>Unweighted GPA {mergePreview.gpa}</span>}
                {mergePreview.sat_score != null && <span>SAT {mergePreview.sat_score}</span>}
                {mergePreview.act_score != null && <span>ACT {mergePreview.act_score}</span>}
                {mergePreview.city && mergePreview.state && (
                  <span>{mergePreview.city}, {mergePreview.state}</span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmMergeOpen(false);
                await onMerge(group.id, [...selectedIds]);
              }}
              disabled={loading}
            >
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss confirmation */}
      <Dialog open={confirmDismissOpen} onOpenChange={setConfirmDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keep These as Separate Recruits?</DialogTitle>
            <DialogDescription>
              These profiles will remain as individual recruits and won&apos;t be flagged
              as potential duplicates again, unless one of them sends a new email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDismissOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setConfirmDismissOpen(false);
                await onDismiss(group.id);
              }}
              disabled={loading}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function DuplicateReviewPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setPageLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/recruits/duplicate-review/groups");
      if (!res.ok) throw new Error("Failed to load review groups");
      const data = await res.json();
      setGroups(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function handleMerge(groupId: string, selectedIds: string[]) {
    setActionLoading(true);
    setErrorMsg(null);
    setWarnMsg(null);
    try {
      const res = await fetch("/api/recruits/duplicate-review/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId, recruit_ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Merge failed");
      }
      if (data.dqs_warning) setWarnMsg(data.dqs_warning);
      await loadGroups();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDismiss(groupId: string) {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/recruits/duplicate-review/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Dismiss failed");
      }
      await loadGroups();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Duplicate Recruit Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We found recruits with matching names that may be the same person. Review each group
          and merge the profiles that belong together, or dismiss if they are different people.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700">
          {errorMsg}
        </div>
      )}
      {warnMsg && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          {warnMsg}
        </div>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading review groups...</p>
        </div>
      ) : !errorMsg && groups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No pending duplicate review groups. You&apos;re all caught up!
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
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {groups.length} group{groups.length !== 1 ? "s" : ""} pending review
          </p>
          {groups.map((group) => (
            <ReviewGroupCard
              key={group.id}
              group={group}
              onMerge={handleMerge}
              onDismiss={handleDismiss}
              loading={actionLoading}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
