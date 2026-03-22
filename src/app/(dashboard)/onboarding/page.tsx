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
import { Check } from "lucide-react";

const STEPS = [
  "Program Setup",
  "Minimum Thresholds",
  "Priority Weights",
  "Roster Context",
  "Complete",
];

const DEFAULT_THRESHOLDS: ThresholdFormData = {
  min_gpa: null,
  min_sat: null,
  min_act: null,
  min_height_by_position: {},
  accepted_grad_years: [],
  accepted_positions: [],
};

const DEFAULT_WEIGHTS: WeightFormData = {
  weight_academic: 70,
  weight_competition: 70,
  weight_physical: 50,
  weight_position_fit: 80,
  weight_grad_year: 50,
  weight_completeness: 20,
};

const DEFAULT_ROSTER: RosterContextFormData = {
  high_need_positions: {},
  priority_grad_years: [],
  roster_spots: {},
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const router = useRouter();
  const supabase = createClient();

  const [thresholds, setThresholds] = useState<ThresholdFormData>(DEFAULT_THRESHOLDS);

  const [weights, setWeights] = useState<WeightFormData>(DEFAULT_WEIGHTS);

  const [roster, setRoster] = useState<RosterContextFormData>(DEFAULT_ROSTER);

  useEffect(() => {
    async function loadPrograms() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Extract email domain
      const emailDomain = user.email.split("@")[1];

      // Load all programs
      const { data } = await supabase.from("programs").select("*").order("name");
      
      if (data) {
        // Filter to only programs matching the user's email domain
        const matchingPrograms = data.filter(p => p.domain === emailDomain);
        setPrograms(matchingPrograms);
        
        // Auto-select if only one matching program
        if (matchingPrograms.length === 1) {
          setSelectedProgramId(matchingPrograms[0].id);
        }
      }
    }
    loadPrograms();
  }, [supabase]);

  useEffect(() => {
    async function loadProgramConfig() {
      if (!selectedProgramId) {
        setThresholds(DEFAULT_THRESHOLDS);
        setWeights(DEFAULT_WEIGHTS);
        setRoster(DEFAULT_ROSTER);
        return;
      }

      const { data: existingConfig } = await supabase
        .from("program_config")
        .select("*")
        .eq("program_id", selectedProgramId)
        .maybeSingle();

      if (!existingConfig) {
        setThresholds(DEFAULT_THRESHOLDS);
        setWeights(DEFAULT_WEIGHTS);
        setRoster(DEFAULT_ROSTER);
        return;
      }

      setThresholds({
        min_gpa: existingConfig.min_gpa,
        min_sat: existingConfig.min_sat,
        min_act: existingConfig.min_act,
        min_height_by_position: existingConfig.min_height_by_position ?? {},
        accepted_grad_years: existingConfig.accepted_grad_years ?? [],
        accepted_positions: existingConfig.accepted_positions ?? [],
      });

      setWeights({
        weight_academic: existingConfig.weight_academic ?? DEFAULT_WEIGHTS.weight_academic,
        weight_competition: existingConfig.weight_competition ?? DEFAULT_WEIGHTS.weight_competition,
        weight_physical: existingConfig.weight_physical ?? DEFAULT_WEIGHTS.weight_physical,
        weight_position_fit: existingConfig.weight_position_fit ?? DEFAULT_WEIGHTS.weight_position_fit,
        weight_grad_year: existingConfig.weight_grad_year ?? DEFAULT_WEIGHTS.weight_grad_year,
        weight_completeness: existingConfig.weight_completeness ?? DEFAULT_WEIGHTS.weight_completeness,
      });

      setRoster({
        high_need_positions: existingConfig.high_need_positions ?? {},
        priority_grad_years: existingConfig.priority_grad_years ?? [],
        roster_spots: existingConfig.roster_spots ?? {},
      });
    }

    loadProgramConfig();
  }, [selectedProgramId, supabase]);

  async function handleComplete() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!selectedProgramId) {
      setLoading(false);
      return;
    }

    // Save program selection
    await supabase
      .from("coaches")
      .update({ program_id: selectedProgramId })
      .eq("id", user.id);

    // Save config
    const configData = {
      updated_by_coach_id: user.id,
      program_id: selectedProgramId,
      ...thresholds,
      ...weights,
      ...roster,
    };

    await supabase.from("program_config").upsert(configData, {
      onConflict: "program_id",
    });

    // Mark onboarding completed, pipeline awaiting admin setup
    await supabase
      .from("coaches")
      .update({
        onboarding_completed: true,
        email_pipeline_status: "pending_setup",
      })
      .eq("id", user.id);

    setLoading(false);
    setStep(4); // Go to Gmail setup step
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < step
                    ? "bg-primary text-white"
                    : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="border-primary/10">
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

            {/* Step 4: Complete */}
            {step === 4 && (
              <div className="space-y-6 text-center py-4">
                <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">You&apos;re all set!</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    We&apos;ll handle the email pipeline setup for you.
                    You&apos;ll receive a notification when it&apos;s active
                    and ready to start processing recruit emails.
                  </p>
                </div>
                <div className="bg-primary/10 rounded-lg p-4 text-left">
                  <p className="text-sm text-primary">
                    <strong>What happens next:</strong> Our team will configure
                    your Gmail integration within 24 hours. Once active, simply
                    apply the &quot;Q5 Recruit AI&quot; label to any
                    recruit email in Gmail and it will automatically appear
                    in your dashboard, scored and ready for review.
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
                  Back
                </Button>
              )}
              {step === 0 && <div />}
              {step < 3 && (
                <Button onClick={() => setStep(step + 1)}>
                  Next
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
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
