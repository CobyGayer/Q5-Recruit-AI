"use client";

import { useEffect } from "react";
import { LEAGUE_TIERS } from "@/lib/data/leagues";
import type { ClubLevel } from "@/types/database";

const ALWAYS_SELECTED_LEAGUES: ClubLevel[] = ["other", "unknown"];
const EDITABLE_LEAGUES = LEAGUE_TIERS.filter(
  (league) => !ALWAYS_SELECTED_LEAGUES.includes(league.id)
);

interface LeagueSelectorProps {
  selected: ClubLevel[];
  onChange: (selected: ClubLevel[]) => void;
  disabled?: boolean;
}

/**
 * Component for coaches to select which leagues they want to track
 * Displays checkboxes for each available league tier
 */
export function LeagueSelector({ selected, onChange, disabled = false }: LeagueSelectorProps) {
  const normalizedSelected = Array.from(new Set([...selected, ...ALWAYS_SELECTED_LEAGUES]));

  useEffect(() => {
    if (normalizedSelected.length !== selected.length) {
      onChange(normalizedSelected);
    }
  }, [normalizedSelected, onChange, selected.length]);

  const toggleLeague = (leagueId: ClubLevel) => {
    if (ALWAYS_SELECTED_LEAGUES.includes(leagueId)) {
      return;
    }

    if (normalizedSelected.includes(leagueId)) {
      onChange(normalizedSelected.filter((id) => id !== leagueId));
    } else {
      onChange([...normalizedSelected, leagueId]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Select which leagues you want to track. Unknown and Other are always included so
        unmatched profiles can still be categorized.
      </p>
      <div className="space-y-2">
        {EDITABLE_LEAGUES.map((league) => (
          <label key={league.id} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={normalizedSelected.includes(league.id)}
              onChange={() => toggleLeague(league.id)}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">{league.displayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
