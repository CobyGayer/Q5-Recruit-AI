"use client";

import { useState } from "react";
import { useQueue } from "@/hooks/use-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProcessingStatus } from "@/types/database";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

const STATUS_CONFIG: Record<
  ProcessingStatus,
  { label: string; icon: typeof CheckCircle; color: string }
> = {
  pending: { label: "Pending", icon: RefreshCw, color: "bg-stone-100 text-stone-600" },
  processing: { label: "Processing", icon: RefreshCw, color: "bg-sky-50 text-sky-700" },
  processed: { label: "Processed", icon: CheckCircle, color: "bg-emerald-50 text-emerald-700" },
  needs_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    color: "bg-amber-50 text-amber-700",
  },
  insufficient: {
    label: "Insufficient Data",
    icon: Info,
    color: "bg-amber-100 text-amber-600",
  },
  failed: { label: "Failed", icon: XCircle, color: "bg-rose-50 text-rose-700" },
};

export default function QueuePage() {
  const { emails, loading, refetch } = useQueue();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function handleRetry(emailId: string) {
    setRetrying(emailId);
    await fetch(`/api/queue/${emailId}/retry`, { method: "POST" });
    await refetch();
    setRetrying(null);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ingestion Queue</h1>
          <p className="text-sm text-muted-foreground">
            {emails.length} emails processed
          </p>
        </div>
        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading queue...</p>
      ) : emails.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No emails have been ingested yet. Set up your Zapier integration
            and start labeling recruit emails to see them here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => {
                const status = STATUS_CONFIG[email.processing_status];
                const StatusIcon = status.icon;
                const isExpanded = expandedId === email.id;

                return (
                  <>
                    <TableRow key={email.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : email.id)}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${status.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{email.sender_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {email.sender_email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {email.subject || "(no subject)"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.received_at
                          ? new Date(email.received_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {email.recruit_id && (
                          <Link
                            href={`/recruits/${email.recruit_id}`}
                            className="text-primary hover:underline text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Profile
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {email.processing_status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetry(email.id);
                              }}
                              disabled={retrying === email.id}
                            >
                              {retrying === email.id ? "Retrying..." : "Retry"}
                            </Button>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${email.id}-expanded`}>
                        <TableCell colSpan={6}>
                          <div className="p-4 bg-muted rounded-lg">
                            {email.extraction_error && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-destructive mb-1">
                                  Error:
                                </p>
                                <p className="text-sm text-destructive">
                                  {email.extraction_error}
                                </p>
                              </div>
                            )}
                            <p className="text-sm font-medium mb-1">
                              Email Body:
                            </p>
                            <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto bg-card p-3 rounded">
                              {email.body_plain || "(empty)"}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
