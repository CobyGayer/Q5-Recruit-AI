"use client";

import { useState, useEffect } from "react";
import { LEAGUE_TIERS } from "@/lib/data/leagues";
import type { ClubLevel } from "@/types/database";

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
  const toggleLeague = (leagueId: ClubLevel) => {
    if (selected.includes(leagueId)) {
      onChange(selected.filter((id) => id !== leagueId));
    } else {
      onChange([...selected, leagueId]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Select which leagues you want to track. Profiles with clubs outside these selections will be marked as "Unknown".
      </p>
      <div className="space-y-2">
        {LEAGUE_TIERS.map((league) => (
          <label key={league.id} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(league.id)}
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
