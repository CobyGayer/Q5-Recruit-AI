"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const SCORE_TIERS = [
  { range: "95-100", label: "Elite", color: "bg-emerald-700" },
  { range: "85-94", label: "Excellent", color: "bg-emerald-500" },
  { range: "70-84", label: "Strong", color: "bg-primary" },
  { range: "55-69", label: "Average", color: "bg-amber-500" },
  { range: "40-54", label: "Below Avg", color: "bg-orange-500" },
  { range: "0-39", label: "Low", color: "bg-rose-500" },
];

const COMPONENTS = [
  {
    name: "Academic",
    description:
      "Evaluates unweighted GPA on a calibrated scale and normalizes standardized test scores (SAT/ACT) to produce a composite academic readiness index.",
  },
  {
    name: "Competition Level",
    description:
      "Classifies competitive environment by verified league tier (MLS NEXT, ECNL, GA, NAL, DPL, and more) using our proprietary club directory.",
  },
  {
    name: "Physical",
    description:
      "Assesses physical profile against position-specific benchmarks derived from collegiate roster data.",
  },
  {
    name: "Position Fit",
    description:
      "Determines alignment between the recruit's position(s) and your roster needs as configured in your settings.",
  },
  {
    name: "Grad Year Fit",
    description:
      "Evaluates whether the recruit's graduation timeline matches your target recruiting classes.",
  },
  {
    name: "Data Completeness",
    description:
      "Measures the breadth of available profile data. More complete profiles yield higher-confidence evaluations.",
  },
];

interface DqsInfoDialogProps {
  trigger?: React.ReactNode;
}

export function DqsInfoDialog({ trigger }: DqsInfoDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
            <span className="sr-only">About DQS</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            DQS: Dynamic Qualification Score
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Q5 Recruit AI&apos;s proprietary multi-factor evaluation framework
          </p>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Overview */}
          <section>
            <p className="text-muted-foreground leading-relaxed">
              The Dynamic Qualification Score (DQS) is a composite 0-100 index
              that evaluates every recruit against your program&apos;s unique
              priorities. Unlike static rating systems, DQS dynamically adapts
              to your coaching preferences. The weight of each factor is fully
              configurable in your settings, ensuring every score reflects
              <span className="font-medium text-foreground"> your </span>
              definition of an ideal recruit.
            </p>
          </section>

          {/* Scoring Components */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Scoring Dimensions
            </h3>
            <div className="grid gap-3">
              {COMPONENTS.map((comp) => (
                <div
                  key={comp.name}
                  className="flex gap-3 items-start rounded-lg border p-3"
                >
                  <div className="w-1 self-stretch rounded-full bg-primary/30 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {comp.name}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">
                      {comp.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              How It Works
            </h3>
            <div className="space-y-2 text-muted-foreground leading-relaxed">
              <p>
                <span className="font-medium text-foreground">
                  Adaptive weighting.
                </span>{" "}
                You assign relative importance to each dimension via the weight
                sliders in Preferences. When a recruit is missing data for a
                dimension, DQS automatically redistributes that weight across
                the remaining dimensions, so the recruit is never penalized for
                data we don&apos;t have.
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Priority bonuses.
                </span>{" "}
                Recruits who play high-need positions or fall within your
                priority graduation years receive targeted bonus points,
                surfacing the prospects that matter most to your program.
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Completeness calibration.
                </span>{" "}
                A profile completeness multiplier moderately adjusts the final
                score to reflect data confidence. Profiles with more verified
                data points receive the full weight of their evaluation, while
                sparse profiles are softly discounted until more data arrives.
              </p>
            </div>
          </section>

          {/* Thresholds */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Qualification Thresholds
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Before scoring begins, each recruit passes through your
              configured minimum requirements: unweighted GPA, test scores, physical
              benchmarks, position needs, and graduation timeline. Any recruit
              that falls below a hard minimum is flagged as{" "}
              <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                NQ (Not Qualified)
              </span>{" "}
              with a clear explanation. Recruits with missing data are{" "}
              <span className="font-medium text-foreground">never</span>{" "}
              disqualified. Only confirmed data below your thresholds triggers
              a disqualification.
            </p>
          </section>

          {/* Score tiers */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Score Tiers
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {SCORE_TIERS.map((tier) => (
                <div key={tier.range} className="text-center space-y-1.5">
                  <div
                    className={`h-2 rounded-full ${tier.color}`}
                  />
                  <p className="text-xs font-medium text-foreground">
                    {tier.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {tier.range}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Customization CTA */}
          <section className="rounded-lg bg-muted/50 p-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              DQS is fully tailored to your program. Adjust scoring weights,
              set minimum thresholds, define position priorities, and target
              graduation years in{" "}
              <span className="font-medium text-foreground">Preferences</span> to
              ensure every score aligns with your recruiting strategy.
            </p>
          </section>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
