"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThresholdForm } from "@/components/config/threshold-form";
import { WeightSelector } from "@/components/config/weight-selector";
import { RosterContextForm } from "@/components/config/roster-context-form";
import { LeagueSelector } from "@/components/config/league-selector";
import { LeagueRater } from "@/components/config/league-rater";
import { LeagueSelectorTabs } from "@/components/config/league-selector-tabs";
import type {
  ThresholdFormData,
  WeightFormData,
  RosterContextFormData,
} from "@/types/config";
import type { ClubLevel } from "@/types/database";
import { createDefaultLeaguePreferences, createDefaultLeagueRatings } from "@/lib/data/leagues";
import { Check, Copy, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [updatingRecruitsFlags, setUpdatingRecruitsFlags] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [leagueTab, setLeagueTab] = useState<"select" | "rate">("select");

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
    high_need_positions: {},
    priority_grad_years: [],
    roster_spots: {},
  });

  const [leaguePreferences, setLeaguePreferences] =
    useState<ClubLevel[]>(createDefaultLeaguePreferences());
  const [leagueRatings, setLeagueRatings] =
    useState<Record<ClubLevel, number>>(createDefaultLeagueRatings());

  useEffect(() => {
    async function loadConfig() {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setThresholds({
            min_gpa: data.min_gpa,
            min_sat: data.min_sat,
            min_act: data.min_act,
            min_height_by_position: data.min_height_by_position || {},
            accepted_grad_years: data.accepted_grad_years || [],
            accepted_positions: data.accepted_positions || [],
          });
          setWeights({
            weight_academic: data.weight_academic ?? 70,
            weight_competition: data.weight_competition ?? 70,
            weight_physical: data.weight_physical ?? 50,
            weight_position_fit: data.weight_position_fit ?? 80,
            weight_grad_year: data.weight_grad_year ?? 50,
            weight_completeness: data.weight_completeness ?? 20,
          });
          setRoster({
            high_need_positions: Array.isArray(data.high_need_positions)
              ? {}
              : (data.high_need_positions || {}),
            priority_grad_years: data.priority_grad_years || [],
            roster_spots: data.roster_spots || {},
          });
          setLeaguePreferences(data.league_preferences || createDefaultLeaguePreferences());
          setLeagueRatings(data.league_ratings || createDefaultLeagueRatings());
        }
      }
      setLoading(false);
    }

    loadConfig();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const body = {
      ...thresholds,
      ...weights,
      ...roster,
      league_preferences: leaguePreferences,
      league_ratings: leagueRatings,
    };

    const saveRes = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!saveRes.ok) {
      const data = await saveRes.json().catch(() => ({}));
      setSaveError(data.error ?? "Failed to save preferences. Please try again.");
      setSaving(false);
      return;
    }

    const savedConfig = await saveRes.json().catch(() => ({}));
    const programId = savedConfig?.program_id;

    setUpdatingRecruitsFlags(true);
    try {
      if (programId) {
        const flagRes = await fetch("/api/recruits/batch-update-league-flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId }),
        });

        const flagText = await flagRes.text();
        if (!flagRes.ok) {
          setSaveError(flagText || "Failed to update recruit flags. Please try again.");
        }
      }
    } finally {
      setUpdatingRecruitsFlags(false);
    }

    setRecalculating(true);
    await fetch("/api/config/recalculate", { method: "POST" });
    setRecalculating(false);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    setSaving(false);
  }

  async function handleRegenerateApiKey() {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_api_key" }),
    });
    const data = await res.json();
    if (data.api_key) {
      setApiKey(data.api_key);
    }
  }

  function copyApiKey() {
    if (!apiKey) return;

    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Preferences</h1>
          <p className="text-muted-foreground">
            Update your program configuration and scoring preferences
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving || updatingRecruitsFlags}>
          {saving ? (
            updatingRecruitsFlags ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Updating profiles...
              </>
            ) : recalculating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Recalculating scores...
              </>
            ) : (
              "Saving..."
            )
          ) : saveSuccess ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            "Save & Recalculate"
          )}
        </Button>
      </div>

      {saveError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <Tabs defaultValue="thresholds">
        <TabsList className="mb-6 flex flex-wrap h-auto">
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="weights">Weights</TabsTrigger>
          <TabsTrigger value="roster">Roster Context</TabsTrigger>
          <TabsTrigger value="leagues">League Preferences</TabsTrigger>
          <TabsTrigger value="api">API Key</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds">
          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <ThresholdForm data={thresholds} onChange={setThresholds} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights">
          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <WeightSelector data={weights} onChange={setWeights} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster">
          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <RosterContextForm data={roster} onChange={setRoster} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leagues">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle>League Preferences</CardTitle>
              <CardDescription>
                Select the leagues you track and rate each league from 0 to 10.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeagueSelectorTabs
                leagueTab={leagueTab}
                onTabChange={setLeagueTab}
                leaguePreferences={leaguePreferences}
                onLeaguePreferencesChange={setLeaguePreferences}
                leagueRatings={leagueRatings}
                onLeagueRatingsChange={setLeagueRatings}
                disabled={saving}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle>API Key</CardTitle>
              <CardDescription>
                Your API key is used to authenticate Zapier webhook requests.
                Regenerating will invalidate the previous key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                    {apiKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyApiKey}>
                    {apiKeyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your current API key is stored securely. If you need a new one, click regenerate.
                </p>
              )}
              <Button variant="outline" onClick={handleRegenerateApiKey}>
                Regenerate API Key
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
