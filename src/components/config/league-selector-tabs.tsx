"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeagueSelector } from "@/components/config/league-selector";
import { LeagueRater } from "@/components/config/league-rater";
import type { ClubLevel } from "@/types/database";

interface LeagueSelectorTabsProps {
  leagueTab: "select" | "rate";
  onTabChange: (tab: "select" | "rate") => void;
  leaguePreferences: ClubLevel[];
  onLeaguePreferencesChange: (preferences: ClubLevel[]) => void;
  leagueRatings: Record<ClubLevel, number>;
  onLeagueRatingsChange: (ratings: Record<ClubLevel, number>) => void;
  disabled?: boolean;
}

export function LeagueSelectorTabs({
  leagueTab,
  onTabChange,
  leaguePreferences,
  onLeaguePreferencesChange,
  leagueRatings,
  onLeagueRatingsChange,
  disabled = false,
}: LeagueSelectorTabsProps) {
  return (
    <Tabs value={leagueTab} onValueChange={(v) => onTabChange(v as "select" | "rate")}>
      <TabsList className="mb-4">
        <TabsTrigger value="select">Select Leagues</TabsTrigger>
        <TabsTrigger value="rate">Rate Leagues</TabsTrigger>
      </TabsList>

      <TabsContent value="select" className="mt-0">
        <LeagueSelector
          selected={leaguePreferences}
          onChange={onLeaguePreferencesChange}
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="rate" className="mt-0">
        <LeagueRater
          ratings={leagueRatings}
          onChange={onLeagueRatingsChange}
          selectedLeagues={leaguePreferences}
          disabled={disabled}
        />
      </TabsContent>
    </Tabs>
  );
}
