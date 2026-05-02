"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, Users, Mail, TrendingUp, BarChart3, Key, Copy, Check, AlertTriangle, RotateCcw, Wrench, Send, Plus, School } from "lucide-react";
import type { Coach, CoachStatus, EmailPipelineStatus, Program } from "@/types/database";

interface AdminStats {
  total_coaches: number;
  pending_coaches: number;
  total_emails: number;
  processed_emails: number;
  failed_emails: number;
  needs_review_emails: number;
  avg_fields_extracted: number;
}

export default function AdminPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [approvalMessage, setApprovalMessage] = useState<{ coachName: string; needsOnboarding: boolean } | null>(null);
  const [generatedKey, setGeneratedKey] = useState<{ coachId: string; coachName: string; key: string } | null>(null);
  const [setupInfoCopied, setSetupInfoCopied] = useState(false);
  const [resetCoachId, setResetCoachId] = useState<string>("");
  const [resetLevel, setResetLevel] = useState<"full" | "pre_onboarding" | "clear_data">("full");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const [sampleResult, setSampleResult] = useState<{ coachId: string; success: boolean; message: string } | null>(null);

  const [dupScanCoachId, setDupScanCoachId] = useState<string>("");
  const [dupScanLoading, setDupScanLoading] = useState(false);
  const [dupScanResult, setDupScanResult] = useState<{ success: boolean; message: string } | null>(null);

  const [missingFieldsScanCoachId, setMissingFieldsScanCoachId] = useState<string>("");
  const [missingFieldsScanLoading, setMissingFieldsScanLoading] = useState(false);
  const [missingFieldsScanResult, setMissingFieldsScanResult] = useState<{ success: boolean; message: string } | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [newProgram, setNewProgram] = useState({ name: "", institution: "", domain: "", division: "", conference: "" });
  const [addProgramLoading, setAddProgramLoading] = useState(false);
  const [addProgramResult, setAddProgramResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchData(true);
    fetchPrograms();
  }, []);

  async function fetchPrograms() {
    setProgramsLoading(true);
    const res = await fetch("/api/admin/programs");
    if (res.ok) setPrograms(await res.json());
    setProgramsLoading(false);
  }

  async function handleAddProgram() {
    if (!newProgram.name || !newProgram.institution || !newProgram.domain) return;
    setAddProgramLoading(true);
    setAddProgramResult(null);
    const res = await fetch("/api/admin/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProgram),
    });
    const data = await res.json();
    if (res.ok) {
      setAddProgramResult({ success: true, message: `Program "${data.name}" added successfully.` });
      setNewProgram({ name: "", institution: "", domain: "", division: "", conference: "" });
      await fetchPrograms();
    } else {
      setAddProgramResult({ success: false, message: data.error || "Failed to add program" });
    }
    setAddProgramLoading(false);
  }

  async function fetchData(isInitial = false) {
    if (isInitial) setLoading(true);
    const [coachRes, statsRes] = await Promise.all([
      fetch("/api/admin/coaches"),
      fetch("/api/admin/stats"),
    ]);

    if (coachRes.ok) {
      setCoaches(await coachRes.json());
    }
    if (statsRes.ok) {
      setStats(await statsRes.json());
    }
    if (isInitial) setLoading(false);
  }

  async function handleApproval(coachId: string, action: "approved" | "rejected") {
    setActionLoading(coachId);
    setApprovalMessage(null);
    const coach = coaches.find((c) => c.id === coachId);
    const res = await fetch(`/api/admin/coaches/${coachId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to ${action === "approved" ? "approve" : "reject"} coach: ${data.error || res.statusText}`);
      setActionLoading(null);
      return;
    }
    await fetchData();
    setActionLoading(null);
    if (action === "approved" && coach) {
      if (coach.onboarding_completed) {
        setActiveTab("pipeline");
      } else {
        setApprovalMessage({ coachName: coach.full_name, needsOnboarding: true });
      }
    }
  }

  async function handleSetupPipeline(coachId: string, coachName: string) {
    setActionLoading(coachId);
    const res = await fetch(`/api/admin/coaches/${coachId}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_api_key" }),
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedKey({ coachId, coachName, key: data.api_key });
      await fetchData();
    }
    setActionLoading(null);
  }

  async function handleUpdatePipelineStatus(coachId: string, status: EmailPipelineStatus) {
    setActionLoading(coachId);
    await fetch(`/api/admin/coaches/${coachId}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_pipeline_status", status }),
    });
    setGeneratedKey(null);
    await fetchData();
    setActionLoading(null);
  }

  function getZapierCopilotPrompt() {
    if (!generatedKey) return "";
    const webhookUrl = `${window.location.origin}/api/ingest/email`;
    return `Create a Zap: When a new email arrives in Gmail matching the search "label:Q5 Recruit AI", send a POST request to ${webhookUrl}. Add a custom header "x-api-key" with value "${generatedKey.key}". Send the following fields as JSON in the request body: "sender_email" mapped to the sender's email address, "subject" mapped to the email subject line, "body_plain" mapped to the plain text body of the email, "received_at" mapped to the date the email was received, and "attachments" mapped to an array of the email's attachment download URLs. If there are no attachments, send an empty array for "attachments".`;
  }

  function copySetupInfo() {
    if (!generatedKey) return;
    navigator.clipboard.writeText(getZapierCopilotPrompt());
    setSetupInfoCopied(true);
    setTimeout(() => setSetupInfoCopied(false), 2000);
  }

  async function handleReset() {
    if (!resetCoachId) return;
    setResetLoading(true);
    setResetResult(null);
    try {
      const res = await fetch(`/api/admin/coaches/${resetCoachId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: resetLevel }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetResult({ success: true, message: data.message });
        await fetchData();
      } else {
        setResetResult({ success: false, message: data.error || "Reset failed" });
      }
    } catch {
      setResetResult({ success: false, message: "Network error" });
    }
    setResetLoading(false);
    setResetDialogOpen(false);
  }

  async function handleMissingFieldsScan() {
    if (!missingFieldsScanCoachId) return;
    setMissingFieldsScanLoading(true);
    setMissingFieldsScanResult(null);
    try {
      const res = await fetch(`/api/admin/coaches/${missingFieldsScanCoachId}/missing-fields-scan`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMissingFieldsScanResult({ success: true, message: data.message });
      } else {
        setMissingFieldsScanResult({ success: false, message: data.error || "Scan failed" });
      }
    } catch {
      setMissingFieldsScanResult({ success: false, message: "Network error" });
    }
    setMissingFieldsScanLoading(false);
  }

  async function handleDuplicateScan() {
    if (!dupScanCoachId) return;
    setDupScanLoading(true);
    setDupScanResult(null);
    try {
      const res = await fetch(`/api/admin/coaches/${dupScanCoachId}/duplicate-scan`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setDupScanResult({ success: true, message: data.message });
      } else {
        setDupScanResult({ success: false, message: data.error || "Scan failed" });
      }
    } catch {
      setDupScanResult({ success: false, message: "Network error" });
    }
    setDupScanLoading(false);
  }

  async function handleSendSample(coachId: string) {
    setSampleLoading(coachId);
    setSampleResult(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/sample-email`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSampleResult({
          coachId,
          success: true,
          message: data.message || "Sample email sent. The coach should forward it to intake@q5recruit.ai to trigger the pipeline.",
        });
      } else {
        setSampleResult({
          coachId,
          success: false,
          message: data.error || "Failed to send sample email",
        });
      }
    } catch {
      setSampleResult({
        coachId,
        success: false,
        message: "Network error",
      });
    }
    setSampleLoading(null);
  }

  const pendingCoaches = coaches.filter((c) => c.status === "pending");
  const allCoaches = coaches.filter((c) => c.status !== "pending");

  const pipelineCoaches = coaches.filter(
    (c) => c.onboarding_completed && c.status === "approved"
  );
  const pendingPipelineCount = pipelineCoaches.filter(
    (c) => c.email_pipeline_status === "pending_setup"
  ).length;

  const pipelineColors: Record<EmailPipelineStatus, string> = {
    not_started: "bg-stone-100 text-stone-600",
    pending_setup: "bg-amber-50 text-amber-700",
    active: "bg-emerald-50 text-emerald-700",
  };

  const statusColors: Record<CoachStatus, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-rose-50 text-rose-700",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-primary/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total_coaches}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Coaches</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total_emails}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Emails Ingested</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/10">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.total_emails > 0
                    ? Math.round(
                        (stats.processed_emails / stats.total_emails) * 100
                      )
                    : 0}
                  %
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Extraction Success Rate
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/10">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.avg_fields_extracted.toFixed(1)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Avg Fields Extracted
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingCoaches.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCoaches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Coaches</TabsTrigger>
          <TabsTrigger value="pipeline">
            Email Pipeline
            {pendingPipelineCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingPipelineCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="programs">
            <School className="h-4 w-4 mr-1" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="devtools">
            <Wrench className="h-4 w-4 mr-1" />
            Dev Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {approvalMessage && (
            <Card className="border-emerald-200 bg-emerald-50 mb-4">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-emerald-800">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  {approvalMessage.coachName} approved!
                </p>
                {approvalMessage.needsOnboarding && (
                  <p className="text-sm text-emerald-700 mt-1">
                    Next step: Complete onboarding. If this is you, navigate to{" "}
                    <a href="/onboarding" className="underline font-medium">/onboarding</a>
                    {" "}to continue the flow.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {pendingCoaches.length === 0 && !approvalMessage ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No pending coach approvals.
              </CardContent>
            </Card>
          ) : pendingCoaches.length === 0 ? null : (
            <Card className="border-primary/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Registered</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCoaches.map((coach) => (
                    <TableRow key={coach.id}>
                      <TableCell className="font-medium">
                        {coach.full_name}
                      </TableCell>
                      <TableCell>{coach.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(coach.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleApproval(coach.id, "approved")
                            }
                            disabled={actionLoading === coach.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApproval(coach.id, "rejected")
                            }
                            disabled={actionLoading === coach.id}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card className="border-primary/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Onboarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCoaches.map((coach) => (
                  <TableRow key={coach.id}>
                    <TableCell className="font-medium">
                      {coach.full_name}
                    </TableCell>
                    <TableCell>{coach.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {coach.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColors[coach.status]}`}
                      >
                        {coach.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coach.onboarding_completed ? "Yes" : "No"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pipeline">
          <div className="space-y-4">
            {/* Shared intake info */}
            <Card className="border-primary/10 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Shared Intake Email</p>
                <p className="text-sm text-muted-foreground">
                  Coaches forward recruit emails to{" "}
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">intake@q5recruit.ai</code>.
                  The system identifies the coach by their sender email address.
                  Bulk forwards (multiple emails as attachments) are supported.
                </p>
                <p className="text-xs text-muted-foreground">
                  Legacy per-coach API keys still work for existing Zapier integrations.
                </p>
              </CardContent>
            </Card>

            {/* Setup card — shown after generating a key (legacy) */}
            {generatedKey && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Pipeline Setup for {generatedKey.coachName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Copy the prompt below and paste it into Zapier Copilot to auto-create the Zap.
                      The coach must first create a Gmail label called &quot;Q5 Recruit AI&quot;.
                    </p>
                    <div className="bg-card px-3 py-2 rounded text-sm border break-all text-muted-foreground">
                      {getZapierCopilotPrompt()}
                    </div>
                    <Button size="sm" variant="outline" onClick={copySetupInfo}>
                      {setupInfoCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Zapier Copilot Prompt
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Reference (do not share — API key is embedded in the prompt above)</p>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Webhook URL</span>
                      <code className="font-mono break-all">
                        {typeof window !== "undefined" ? `${window.location.origin}/api/ingest/email` : "/api/ingest/email"}
                      </code>
                      <span className="text-muted-foreground">API Key</span>
                      <code className="font-mono break-all">{generatedKey.key}</code>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleUpdatePipelineStatus(generatedKey.coachId, "active")}
                    disabled={actionLoading === generatedKey.coachId}
                  >
                    Mark as Active
                  </Button>
                </CardContent>
              </Card>
            )}

            {pipelineCoaches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No coaches ready for pipeline setup yet.
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wider">Coach</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Pipeline Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Has API Key</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipelineCoaches.map((coach) => (
                      <TableRow key={coach.id}>
                        <TableCell className="font-medium">{coach.full_name}</TableCell>
                        <TableCell>{coach.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${pipelineColors[coach.email_pipeline_status ?? "not_started"]}`}
                          >
                            {(coach.email_pipeline_status ?? "not_started").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{coach.api_key ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetupPipeline(coach.id, coach.full_name)}
                              disabled={actionLoading === coach.id}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              {coach.api_key ? "Regenerate Key" : "Setup Pipeline"}
                            </Button>
                            {coach.email_pipeline_status !== "active" && (
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePipelineStatus(coach.id, "active")}
                                disabled={actionLoading === coach.id}
                              >
                                Mark Active
                              </Button>
                            )}
                            {coach.email_pipeline_status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdatePipelineStatus(coach.id, "pending_setup")}
                                disabled={actionLoading === coach.id}
                              >
                                Deactivate
                              </Button>
                            )}
                            {coach.api_key && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendSample(coach.id)}
                                disabled={actionLoading === coach.id || sampleLoading === coach.id}
                              >
                                {sampleLoading === coach.id ? (
                                  "Sending..."
                                ) : (
                                  <>
                                    <Send className="h-4 w-4 mr-1" />
                                    Send Sample
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {sampleResult && (
              <div
                className={`p-3 rounded text-sm ${
                  sampleResult.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {sampleResult.message}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="programs">
          <div className="space-y-4">
            <Card className="border-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Program
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Program Name <span className="text-rose-500">*</span></Label>
                    <Input
                      placeholder="e.g. Stanford Men's Soccer"
                      value={newProgram.name}
                      onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Institution <span className="text-rose-500">*</span></Label>
                    <Input
                      placeholder="e.g. Stanford University"
                      value={newProgram.institution}
                      onChange={(e) => setNewProgram({ ...newProgram, institution: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email Domain <span className="text-rose-500">*</span></Label>
                    <Input
                      placeholder="e.g. stanford.edu"
                      value={newProgram.domain}
                      onChange={(e) => setNewProgram({ ...newProgram, domain: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Division</Label>
                    <Input
                      placeholder="e.g. D1"
                      value={newProgram.division}
                      onChange={(e) => setNewProgram({ ...newProgram, division: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conference</Label>
                    <Input
                      placeholder="e.g. Pac-12"
                      value={newProgram.conference}
                      onChange={(e) => setNewProgram({ ...newProgram, conference: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddProgram}
                  disabled={addProgramLoading || !newProgram.name || !newProgram.institution || !newProgram.domain}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {addProgramLoading ? "Adding..." : "Add Program"}
                </Button>
                {addProgramResult && (
                  <p className={`text-sm ${addProgramResult.success ? "text-emerald-700" : "text-rose-700"}`}>
                    {addProgramResult.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Existing Programs</CardTitle>
              </CardHeader>
              <CardContent>
                {programsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : programs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No programs found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Institution</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Domain</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Division</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Conference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {programs.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.institution}</TableCell>
                          <TableCell className="font-mono text-xs">{p.domain}</TableCell>
                          <TableCell>{p.division ?? "—"}</TableCell>
                          <TableCell>{p.conference ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devtools">
          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Coach Reset Tool
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Reset a coach account to test the full onboarding flow. This is destructive and will delete data.
                </p>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Coach</Label>
                  <Select value={resetCoachId} onValueChange={setResetCoachId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a coach..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reset Level</Label>
                  <Select value={resetLevel} onValueChange={(v) => setResetLevel(v as typeof resetLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Reset — back to pending approval</SelectItem>
                      <SelectItem value="pre_onboarding">Pre-Onboarding — keep approved, clear config + data</SelectItem>
                      <SelectItem value="clear_data">Clear Data — keep config, clear recruits + emails</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="bg-card rounded border p-3 text-xs space-y-1">
                    {resetLevel === "full" && (
                      <>
                        <p className="font-medium text-rose-700">Deletes everything. Coach must be re-approved.</p>
                        <p className="text-muted-foreground">
                          Sets status to pending, clears onboarding, program config, API key, all recruits, emails, and scores.
                        </p>
                      </>
                    )}
                    {resetLevel === "pre_onboarding" && (
                      <>
                        <p className="font-medium text-amber-700">Keeps approval. Clears everything else.</p>
                        <p className="text-muted-foreground">
                          Coach remains approved but must redo onboarding. Clears program config, API key, all recruits, emails, and scores.
                        </p>
                      </>
                    )}
                    {resetLevel === "clear_data" && (
                      <>
                        <p className="font-medium text-amber-600">Keeps config. Clears pipeline data only.</p>
                        <p className="text-muted-foreground">
                          Coach stays approved with onboarding intact. Clears API key, all recruits, emails, and scores.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={!resetCoachId || resetLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset Coach
                </Button>

                {resetResult && (
                  <div
                    className={`p-3 rounded text-sm ${
                      resetResult.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {resetResult.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Temporary duplicate-scan trigger */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Duplicate Recruit Scan
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Temporary</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bulk-scan a coach&apos;s program for same-name recruit clusters and queue pending
                  duplicate review groups. The coach will be prompted to resolve duplicates on their
                  next dashboard visit. This does <strong>not</strong> merge anything automatically.
                </p>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Coach</Label>
                  <Select value={dupScanCoachId} onValueChange={setDupScanCoachId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a coach..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={handleDuplicateScan}
                  disabled={!dupScanCoachId || dupScanLoading}
                >
                  <Users className="h-4 w-4 mr-1" />
                  {dupScanLoading ? "Scanning..." : "Run Duplicate Scan"}
                </Button>

                {dupScanResult && (
                  <div
                    className={`p-3 rounded text-sm ${
                      dupScanResult.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {dupScanResult.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Temporary missing-fields-scan trigger */}
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-500" />
                  Missing Fields Scan
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Temporary</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bulk-scan a coach&apos;s program for recruits with missing fields and queue them for
                  review. Coaches will see the missing-fields queue on their next dashboard visit.
                  Recruits already in the queue or with no weight-adjusted missing fields are skipped.
                </p>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Coach</Label>
                  <Select value={missingFieldsScanCoachId} onValueChange={setMissingFieldsScanCoachId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a coach..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={handleMissingFieldsScan}
                  disabled={!missingFieldsScanCoachId || missingFieldsScanLoading}
                >
                  <Users className="h-4 w-4 mr-1" />
                  {missingFieldsScanLoading ? "Scanning..." : "Run Missing Fields Scan"}
                </Button>

                {missingFieldsScanResult && (
                  <div
                    className={`p-3 rounded text-sm ${
                      missingFieldsScanResult.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {missingFieldsScanResult.message}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Coach States</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wider">Coach</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Onboarded</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Pipeline</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Has Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coaches.map((coach) => (
                      <TableRow key={coach.id}>
                        <TableCell className="font-medium">{coach.full_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${statusColors[coach.status]}`}>
                            {coach.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{coach.onboarding_completed ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${pipelineColors[coach.email_pipeline_status ?? "not_started"]}`}
                          >
                            {(coach.email_pipeline_status ?? "not_started").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{coach.api_key ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Reset</DialogTitle>
                <DialogDescription>
                  Are you sure you want to perform a{" "}
                  <strong>
                    {resetLevel === "full"
                      ? "Full Reset"
                      : resetLevel === "pre_onboarding"
                        ? "Pre-Onboarding Reset"
                        : "Clear Data"}
                  </strong>{" "}
                  on <strong>{coaches.find((c) => c.id === resetCoachId)?.full_name}</strong>?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReset} disabled={resetLoading}>
                  {resetLoading ? "Resetting..." : "Confirm Reset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
