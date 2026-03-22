"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DqsBadge } from "@/components/scoring/dqs-badge";
import { ScoreBreakdown } from "@/components/scoring/score-breakdown";
import { DqsInfoDialog } from "@/components/scoring/dqs-info-dialog";
import { CompletenessIndicator } from "@/components/scoring/completeness-indicator";
import { FlagButton } from "@/components/recruits/flag-button";
import { ConfidenceBadge } from "@/components/recruits/confidence-badge";
import { EmailComposeDialog } from "@/components/email/email-compose-dialog";
import { RequestInfoDialog } from "@/components/email/request-info-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { Recruit, RecruitDqsScore, CoachRecruitFlag, TranscriptAnalysis, ConfidenceLevel } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Mail,
} from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name",
  email: "Email",
  phone: "Phone",
  graduation_year: "Graduation Year",
  current_school: "Current School",
  city: "City",
  state: "State",
  country: "Country",
  positions: "Position(s)",
  preferred_foot: "Preferred Foot",
  height_inches: "Height (inches)",
  weight_lbs: "Weight (lbs)",
  gpa: "GPA",
  sat_score: "SAT Score",
  act_score: "ACT Score",
  club_team: "Club Team",
  club_level: "Club Level",
  high_school_team: "High School Team",
  video_url: "Highlight Video",
};

const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  ecnl: "ECNL",
  ga: "GA",
  regional: "Regional",
  other: "Other",
  unknown: "Unknown",
};

export default function RecruitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [recruit, setRecruit] = useState<Recruit | null>(null);
  const [dqsScore, setDqsScore] = useState<RecruitDqsScore | null>(null);
  const [flag, setFlag] = useState<CoachRecruitFlag | null>(null);
  const [originalEmail, setOriginalEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailReceivedAt, setEmailReceivedAt] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [selectedMissingFields, setSelectedMissingFields] = useState<string[]>([]);
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [coachEmail, setCoachEmail] = useState<string | undefined>();
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<TranscriptAnalysis | null>(null);

  useEffect(() => {
    async function loadRecruit() {
      const { data: recruitData } = await supabase
        .from("recruits")
        .select("*")
        .eq("id", id)
        .single();

      if (!recruitData) {
        setLoading(false);
        return;
      }

      setRecruit(recruitData as Recruit);

      // Fetch DQS score
      const { data: scoreData } = await supabase
        .from("recruit_dqs_scores")
        .select("*")
        .eq("recruit_id", id)
        .single();
      setDqsScore(scoreData as RecruitDqsScore | null);

      // Fetch flag
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCoachEmail(user.email ?? undefined);
        const { data: flagData } = await supabase
          .from("coach_recruit_flags")
          .select("*")
          .eq("recruit_id", id)
          .eq("coach_id", user.id)
          .single();
        setFlag(flagData as CoachRecruitFlag | null);
      }

      // Fetch original email
      const { data: emailData } = await supabase
        .from("ingested_emails")
        .select("body_plain, received_at")
        .eq("recruit_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setOriginalEmail(emailData?.body_plain ?? null);
      setEmailReceivedAt(emailData?.received_at ?? null);

      // Fetch transcript analysis
      const { data: transcriptData } = await supabase
        .from("transcript_analyses")
        .select("*")
        .eq("recruit_id", id)
        .single();
      setTranscriptAnalysis(transcriptData as TranscriptAnalysis | null);

      setLoading(false);
    }
    loadRecruit();
  }, [id, supabase]);

  async function handleSaveEdit() {
    if (!recruit) return;
    setSaving(true);

    await supabase.from("recruits").update(editData).eq("id", recruit.id);

    // Trigger DQS recalculation
    await fetch("/api/config/recalculate", { method: "POST" });

    // Reload data
    const { data: updated } = await supabase
      .from("recruits")
      .select("*")
      .eq("id", recruit.id)
      .single();
    if (updated) setRecruit(updated as Recruit);

    const { data: newScore } = await supabase
      .from("recruit_dqs_scores")
      .select("*")
      .eq("recruit_id", recruit.id)
      .single();
    setDqsScore(newScore as RecruitDqsScore | null);

    setEditing(false);
    setSaving(false);
  }

  function startEditing() {
    if (!recruit) return;
    setEditData({
      full_name: recruit.full_name,
      email: recruit.email,
      phone: recruit.phone,
      graduation_year: recruit.graduation_year,
      current_school: recruit.current_school,
      city: recruit.city,
      state: recruit.state,
      positions: recruit.positions,
      preferred_foot: recruit.preferred_foot,
      height_inches: recruit.height_inches,
      weight_lbs: recruit.weight_lbs,
      gpa: recruit.gpa,
      sat_score: recruit.sat_score,
      act_score: recruit.act_score,
      club_team: recruit.club_team,
      club_level: recruit.club_level,
      high_school_team: recruit.high_school_team,
      video_url: recruit.video_url,
    });
    setEditing(true);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/recruits/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function copyEmail() {
    if (recruit?.email) {
      navigator.clipboard.writeText(recruit.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!recruit) {
    return (
      <div className="p-6">
        <p>Recruit not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const confidence = recruit.extraction_confidence as Record<string, ConfidenceLevel>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <DqsBadge
            score={dqsScore?.overall_score ?? null}
            isQualified={dqsScore?.is_qualified ?? true}
            disqualificationReasons={dqsScore?.disqualification_reasons}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold">
              {recruit.full_name || "Unknown Name"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {recruit.positions.map((pos) => (
                <Badge key={pos} variant="outline" className="border-primary/40 text-primary">
                  {pos}
                </Badge>
              ))}
              {recruit.graduation_year && (
                <span className="text-sm text-muted-foreground">
                  Class of {recruit.graduation_year}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FlagButton
            recruitId={recruit.id}
            currentFlag={flag?.flag ?? null}
          />
          {recruit.email && (
            <>
              <Button size="sm" onClick={() => setEmailComposeOpen(true)}>
                <Mail className="h-4 w-4 mr-1" />
                Email Recruit
              </Button>
              <Button variant="outline" size="sm" onClick={copyEmail}>
                {emailCopied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {emailCopied ? "Copied!" : "Copy Email"}
              </Button>
            </>
          )}
          {!editing && (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Email compose dialog */}
      <EmailComposeDialog
        open={emailComposeOpen}
        onClose={() => setEmailComposeOpen(false)}
        recruitId={recruit.id}
        recruitName={recruit.full_name}
        recruitEmail={recruit.email}
        coachEmail={coachEmail}
      />

      {/* Request info dialog */}
      <RequestInfoDialog
        open={requestInfoOpen}
        onClose={() => {
          setRequestInfoOpen(false);
          setSelectedMissingFields([]);
        }}
        recruitId={recruit.id}
        recruitName={recruit.full_name}
        recruitEmail={recruit.email}
        selectedFields={selectedMissingFields}
        fieldLabels={FIELD_LABELS}
        coachEmail={coachEmail}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Recruit</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {recruit.full_name || "this recruit"}
              </span>
              ? This will permanently remove their profile, scores, and all
              associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Recruit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dqsScore?.ai_summary && (
        <p className="text-sm text-muted-foreground mb-6">
          {dqsScore.ai_summary}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Profile fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Profile Information</CardTitle>
              <CompletenessIndicator
                fieldsExtracted={recruit.fields_extracted}
                fieldsTotal={recruit.fields_total}
                fieldsMissing={recruit.fields_missing}
              />
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  {Object.entries(FIELD_LABELS).map(([key, label]) => {
                    if (key === "positions") return null; // Handle separately
                    return (
                      <div key={key} className="grid grid-cols-3 gap-2 items-center">
                        <Label className="text-sm">{label}</Label>
                        <Input
                          className="col-span-2"
                          value={String(editData[key] ?? "")}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              [key]:
                                e.target.value === ""
                                  ? null
                                  : ["graduation_year", "height_inches", "weight_lbs", "sat_score", "act_score"].includes(key)
                                  ? parseInt(e.target.value)
                                  : key === "gpa"
                                  ? parseFloat(e.target.value)
                                  : e.target.value,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveEdit} disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(FIELD_LABELS).map(([key, label]) => {
                    let displayValue: string;
                    const rawValue = (recruit as unknown as Record<string, unknown>)[key];

                    if (key === "positions") {
                      displayValue =
                        recruit.positions.length > 0
                          ? recruit.positions.join(", ")
                          : "—";
                    } else if (key === "club_level") {
                      displayValue =
                        CLUB_LEVEL_LABELS[recruit.club_level] ?? "—";
                    } else if (key === "height_inches" && recruit.height_inches) {
                      const ft = Math.floor(recruit.height_inches / 12);
                      const inches = recruit.height_inches % 12;
                      displayValue = `${ft}'${inches}" (${recruit.height_inches}")`;
                    } else if (key === "video_url" && recruit.video_url) {
                      displayValue = recruit.video_url;
                    } else {
                      displayValue =
                        rawValue != null ? String(rawValue) : "—";
                    }

                    const isMissing = recruit.fields_missing.includes(key);

                    return (
                      <div
                        key={key}
                        className="grid grid-cols-3 gap-2 items-center py-1 border-b last:border-0"
                      >
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          {confidence[key] && (
                            <ConfidenceBadge confidence={confidence[key]} />
                          )}
                          {label}
                        </span>
                        <span
                          className={`col-span-2 text-sm ${
                            isMissing ? "text-muted-foreground italic" : ""
                          }`}
                        >
                          {isMissing ? "Not found in email" : displayValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Embedded video */}
          {recruit.video_url && (
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle>Highlight Video</CardTitle>
              </CardHeader>
              <CardContent>
                {recruit.video_url.includes("youtube.com") ||
                recruit.video_url.includes("youtu.be") ? (
                  <div className="aspect-video">
                    <iframe
                      src={recruit.video_url
                        .replace("watch?v=", "embed/")
                        .replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a
                    href={recruit.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    {recruit.video_url}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Original email */}
          {originalEmail && (
            <Card className="border-primary/10">
              <CardHeader>
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowEmail(!showEmail)}
                >
                  <CardTitle>
                    Original Email
                    {emailReceivedAt && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({new Date(emailReceivedAt).toLocaleDateString()})
                      </span>
                    )}
                  </CardTitle>
                  {showEmail ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </CardHeader>
              {showEmail && (
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg max-h-96 overflow-auto">
                    {originalEmail}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Right: Score breakdown */}
        <div className="space-y-6">
          {dqsScore && (
            <Card className="border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Score Breakdown</CardTitle>
                <DqsInfoDialog />
              </CardHeader>
              <CardContent>
                <ScoreBreakdown score={dqsScore} rigorGrade={transcriptAnalysis?.rigor_grade} />
              </CardContent>
            </Card>
          )}

          {transcriptAnalysis && transcriptAnalysis.transcript_readable && (
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Transcript Analysis
                  <Badge
                    variant="secondary"
                    className={
                      transcriptAnalysis.rigor_grade.startsWith("A")
                        ? "bg-emerald-100 text-emerald-800"
                        : transcriptAnalysis.rigor_grade.startsWith("B")
                        ? "bg-blue-100 text-blue-800"
                        : transcriptAnalysis.rigor_grade === "C+" || transcriptAnalysis.rigor_grade === "C"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    Rigor: {transcriptAnalysis.rigor_grade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transcriptAnalysis.admissions_notes && (
                  <p className="text-sm text-muted-foreground italic">
                    {transcriptAnalysis.admissions_notes}
                  </p>
                )}
                {transcriptAnalysis.strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Strengths</p>
                    <div className="flex flex-wrap gap-1">
                      {transcriptAnalysis.strengths.map((s, i) => (
                        <Badge key={i} variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {transcriptAnalysis.red_flags.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Red Flags</p>
                    <div className="flex flex-wrap gap-1">
                      {transcriptAnalysis.red_flags.map((f, i) => (
                        <Badge key={i} variant="secondary" className="bg-red-50 text-red-700 text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {transcriptAnalysis.grade_trend && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      Grade Trend: {transcriptAnalysis.grade_trend.charAt(0).toUpperCase() + transcriptAnalysis.grade_trend.slice(1)}
                    </span>
                    {transcriptAnalysis.grade_trend_notes && (
                      <span>— {transcriptAnalysis.grade_trend_notes}</span>
                    )}
                  </div>
                )}
                {transcriptAnalysis.notable_courses.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notable Courses</p>
                    <p className="text-xs text-muted-foreground">
                      {transcriptAnalysis.notable_courses.join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dqsScore && !dqsScore.is_qualified && (
            <Card className="border-rose-200 bg-rose-50">
              <CardHeader>
                <CardTitle className="text-rose-700">Not Qualified</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {dqsScore.disqualification_reasons.map((reason, i) => (
                    <li key={i} className="text-sm text-rose-600">
                      {reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {recruit.fields_missing.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-700 text-sm">
                  Missing Data ({recruit.fields_missing.length} fields)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Select All checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={
                      selectedMissingFields.length === recruit.fields_missing.length
                        ? true
                        : selectedMissingFields.length > 0
                        ? "indeterminate"
                        : false
                    }
                    onCheckedChange={() => {
                      if (selectedMissingFields.length === recruit.fields_missing.length) {
                        setSelectedMissingFields([]);
                      } else {
                        setSelectedMissingFields([...recruit.fields_missing]);
                      }
                    }}
                  />
                  <span className="text-xs font-medium text-amber-800">
                    Select All
                  </span>
                </label>

                {/* Individual field checkboxes */}
                <div className="flex flex-wrap gap-2">
                  {recruit.fields_missing.map((field) => (
                    <label
                      key={field}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMissingFields.includes(field)}
                        onCheckedChange={() => {
                          setSelectedMissingFields((prev) =>
                            prev.includes(field)
                              ? prev.filter((f) => f !== field)
                              : [...prev, field]
                          );
                        }}
                      />
                      <Badge variant="outline" className="text-xs bg-card">
                        {FIELD_LABELS[field] ?? field}
                      </Badge>
                    </label>
                  ))}
                </div>

                {/* Request Info button */}
                {recruit.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
                    disabled={selectedMissingFields.length === 0}
                    onClick={() => setRequestInfoOpen(true)}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Request Info ({selectedMissingFields.length} field
                    {selectedMissingFields.length !== 1 ? "s" : ""})
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
