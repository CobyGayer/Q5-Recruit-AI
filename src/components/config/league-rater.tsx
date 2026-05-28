"use client";

import { useState } from "react";
import { LEAGUE_TIERS } from "@/lib/data/leagues";
import type { ClubLevel } from "@/types/database";

interface LeagueRaterProps {
  ratings: Record<ClubLevel, number>;
  onChange: (ratings: Record<ClubLevel, number>) => void;
  selectedLeagues?: ClubLevel[];
  disabled?: boolean;
}

/**
 * Component for coaches to rate leagues on a 0-10 scale
 * Optionally highlights only selected leagues if selectedLeagues is provided
 */
export function LeagueRater({
  ratings,
  onChange,
  selectedLeagues,
  disabled = false,
}: LeagueRaterProps) {
  const [errors, setErrors] = useState<Partial<Record<ClubLevel, string>>>({});

  const handleRatingChange = (leagueId: ClubLevel, value: string) => {
    const num = parseFloat(value);
    const newErrors = { ...errors };

    // Validation
    if (isNaN(num)) {
      newErrors[leagueId] = "Must be a number";
    } else if (num < 0 || num > 10) {
      newErrors[leagueId] = "Must be between 0 and 10";
    } else {
      delete newErrors[leagueId];
    }

    setErrors(newErrors);

    if (!isNaN(num) && num >= 0 && num <= 10) {
      onChange({
        ...ratings,
        [leagueId]: num,
      });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Rate each league from 0-10, where 10 is the best and 0 is the worst. This helps prioritize your recruit search.
      </p>
      <div className="space-y-4">
        {LEAGUE_TIERS.map((league) => {
          const isSelected = !selectedLeagues || selectedLeagues.includes(league.id);
          const rating = ratings[league.id] ?? 5;

          return (
            <div
              key={league.id}
              className={`flex items-center justify-between p-3 border rounded ${
                isSelected ? "bg-white border-gray-300" : "bg-gray-50 border-gray-200 opacity-60"
              }`}
            >
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">{league.displayLabel}</label>
                {!isSelected && <p className="text-xs text-gray-500">Not selected</p>}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={rating}
                  onChange={(e) => handleRatingChange(league.id, e.target.value)}
                  disabled={disabled || !isSelected}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                />
                <span className="text-xs text-gray-500 w-8">/10</span>
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(errors).length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {Object.values(errors).map((error, idx) => (
            <div key={idx}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
