"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThresholdForm } from "@/components/config/threshold-form";
import { WeightSelector } from "@/components/config/weight-selector";
import { RosterContextForm } from "@/components/config/roster-context-form";
import type { ThresholdFormData, WeightFormData, RosterContextFormData } from "@/types/config";
import type { Program } from "@/types/database";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";

const STEPS = [
  "Program Setup",
  "Minimum Thresholds",
  "Priority Weights",
  "Roster Context",
  "Gmail Setup",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [thresholds, setThresholds] = useState<ThresholdFormData>({
    min_gpa: null,
    min_sat: null,
    min_act: null,
    min_height_by_position: {},
    accepted_grad_years: [],
    accepted_positions: [],
  });

  const [weights, setWeights] = useState<WeightFormData>({
    weight_academic: 70,
    weight_competition: 70,
    weight_physical: 50,
    weight_position_fit: 80,
    weight_grad_year: 50,
    weight_completeness: 20,
  });

  const [roster, setRoster] = useState<RosterContextFormData>({
    high_need_positions: [],
    priority_grad_years: [],
    roster_spots: {},
  });

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from("programs").select("*").order("name");
      if (data) setPrograms(data);
    }
    loadPrograms();
  }, [supabase]);

  async function handleComplete() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Save program selection
    if (selectedProgramId) {
      await supabase
        .from("coaches")
        .update({ program_id: selectedProgramId })
        .eq("id", user.id);
    }

    // Save config
    const configData = {
      coach_id: user.id,
      ...thresholds,
      ...weights,
      ...roster,
    };

    await supabase.from("program_config").upsert(configData, {
      onConflict: "coach_id",
    });

    // Generate API key
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_api_key" }),
    });
    const keyData = await res.json();
    if (keyData.api_key) {
      setApiKey(keyData.api_key);
    }

    // Mark onboarding completed
    await supabase
      .from("coaches")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    setLoading(false);
    setStep(4); // Go to Gmail setup step
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  function copyApiKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < step
                    ? "bg-green-500 text-white"
                    : i === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>
              Step {step + 1} of {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 0: Program Setup */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Your Program</Label>
                  <Select
                    value={selectedProgramId}
                    onValueChange={setSelectedProgramId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your program..." />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.institution})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t see your program? Contact your admin to add it.
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Thresholds */}
            {step === 1 && (
              <ThresholdForm data={thresholds} onChange={setThresholds} />
            )}

            {/* Step 2: Weights */}
            {step === 2 && (
              <WeightSelector data={weights} onChange={setWeights} />
            )}

            {/* Step 3: Roster Context */}
            {step === 3 && (
              <RosterContextForm data={roster} onChange={setRoster} />
            )}

            {/* Step 4: Gmail Setup */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="font-medium">Your API Key</h4>
                  <p className="text-sm text-muted-foreground">
                    Copy this key — you&apos;ll need it for Zapier setup. It
                    will only be shown once.
                  </p>
                  {apiKey && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                        {apiKey}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyApiKey}
                      >
                        {apiKeyCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Gmail Setup Instructions</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>
                      In Gmail, create a new label called{" "}
                      <strong>&quot;Recruiting Score AI&quot;</strong>
                    </li>
                    <li>
                      Go to{" "}
                      <strong>zapier.com</strong> and create a new Zap
                    </li>
                    <li>
                      Set the trigger to{" "}
                      <strong>Gmail → New Email Matching Search</strong> with
                      the label &quot;Recruiting Score AI&quot;
                    </li>
                    <li>
                      Set the action to{" "}
                      <strong>Webhooks by Zapier → POST</strong>
                    </li>
                    <li>
                      Set the URL to your platform&apos;s ingestion endpoint
                    </li>
                    <li>
                      Add header: <code>x-api-key</code> with your API key
                      above
                    </li>
                    <li>
                      Map the email fields (From, Subject, Body Plain, Date) to
                      the payload
                    </li>
                    <li>Test the Zap and turn it on!</li>
                  </ol>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>How it works:</strong> When you apply the
                    &quot;Recruiting Score AI&quot; label to any recruit email in
                    Gmail, Zapier will automatically send it to your dashboard.
                    The AI will extract the recruit&apos;s information and score
                    them based on your configured preferences.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              {step > 0 && step < 4 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {step === 0 && <div />}
              {step < 3 && (
                <Button onClick={() => setStep(step + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={handleComplete} disabled={loading}>
                  {loading ? "Saving..." : "Save & Continue"}
                </Button>
              )}
              {step === 4 && (
                <Button onClick={handleFinish} className="ml-auto">
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
