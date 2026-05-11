import type { Recruit, ProgramConfig, ClubLevel, TranscriptAnalysis } from "@/types/database";
import { lookupClubLevel } from "@/lib/data/club-directory";
import { POSITIONS } from "@/types/config";

/** Club level tier scores */
const CLUB_LEVEL_SCORES: Record<ClubLevel, number> = {
  mls_next: 100,
  ecnl: 90,
  ga: 75,
  ga_aspire: 75,
  regional: 55,
  other: 35,
  unknown: 50,
};

/**
 * Score academic strength (0-100).
 * GPA is primary (70%), test scores are secondary (30%) if available.
 * When a transcript analysis exists, applies a rigor modifier (±15%) to the base score.
 */
export function scoreAcademic(
  recruit: Recruit,
  transcriptAnalysis?: TranscriptAnalysis | null
): number | null {
  if (recruit.gpa == null && recruit.sat_score == null && recruit.act_score == null) {
    return null; // No academic data at all
  }

  let gpaScore: number | null = null;
  const testScores: number[] = [];

  // GPA: linear mapping from 2.0→0 to 4.0→100
  if (recruit.gpa != null) {
    gpaScore = Math.max(0, Math.min(100, ((recruit.gpa - 2.0) / 2.0) * 100));
  }

  // Test scores: normalize to 0-100
  if (recruit.sat_score != null) {
    // SAT: 400-1600 mapped to 0-100
    testScores.push(Math.max(
      0,
      Math.min(100, ((recruit.sat_score - 400) / 1200) * 100)
    ));
  }
  if (recruit.act_score != null) {
    // ACT: 1-36 mapped to 0-100
    testScores.push(Math.max(
      0,
      Math.min(100, ((recruit.act_score - 1) / 35) * 100)
    ));
  }

  const testScore =
    testScores.length > 0
      ? testScores.reduce((sum, score) => sum + score, 0) / testScores.length
      : null;

  // Blend: 70% GPA, 30% test if both available
  let baseScore: number;
  if (gpaScore != null && testScore != null) {
    baseScore = gpaScore * 0.7 + testScore * 0.3;
  } else {
    baseScore = gpaScore ?? testScore ?? 0;
  }

  // Apply rigor modifier if transcript was analyzed
  // Range: 0.85 (rigor_score=0) to 1.15 (rigor_score=100), neutral at 50
  if (transcriptAnalysis?.transcript_readable && transcriptAnalysis.rigor_score != null) {
    const modifier = 0.85 + (transcriptAnalysis.rigor_score / 100) * 0.30;
    baseScore = Math.min(100, Math.max(0, baseScore * modifier));
  }

  return baseScore;
}

/**
 * Score competition level (0-100).
 * Direct lookup based on club tier, using gender-specific club directory if provided.
 *
 * @param recruit The recruit record
 * @param isBoys Optional: true for boys club directory, false for girls; defaults to true
 */
export function scoreCompetition(recruit: Recruit, isBoys: boolean = true): number | null {
  if (recruit.club_level === "unknown" && !recruit.club_team) {
    return null; // No competition data
  }

  // Fallback: if club_level is unknown but club_team exists, try gender-aware directory lookup
  let level: ClubLevel = recruit.club_level;
  if (level === "unknown" && recruit.club_team) {
    level = lookupClubLevel(recruit.club_team, isBoys);
  }

  return CLUB_LEVEL_SCORES[level] ?? 50;
}

/**
 * Score physical attributes (0-100).
 * Height relative to position expectations.
 */
export function scorePhysical(
  recruit: Recruit,
  config: ProgramConfig
): number | null {
  if (recruit.height_inches == null) {
    return null; // No physical data
  }

  // If no height expectations set, score based on general range (66-76 inches)
  if (
    !config.min_height_by_position ||
    Object.keys(config.min_height_by_position).length === 0
  ) {
    // General scoring: 66" = 50, 72" = 100
    return Math.max(0, Math.min(100, ((recruit.height_inches - 60) / 16) * 100));
  }

  // Score against position-specific expectations
  let bestScore = 50; // Default if no matching position found
  for (const position of recruit.positions) {
    const expected = config.min_height_by_position[position];
    if (expected != null) {
      const diff = recruit.height_inches - expected;
      if (diff >= 0) {
        // At or above minimum: 100 + 5 per extra inch (capped at 100)
        bestScore = Math.min(100, 100 + diff * 5);
      } else {
        // Below minimum: -15 per inch below
        bestScore = Math.max(0, 100 + diff * 15);
      }
    }
  }

  return bestScore;
}

/**
 * Score position fit (0-100).
 * 100 if matches accepted positions, 0 if not.
 */
export function scorePositionFit(
  recruit: Recruit,
  config: ProgramConfig
): number | null {
  const knownPositions = recruit.positions.filter((pos) =>
    (POSITIONS as readonly string[]).includes(pos)
  );

  if (knownPositions.length === 0) {
    return null; // No recognized position data — treat as missing
  }

  if (config.accepted_positions.length === 0) {
    return 100; // Coach accepts all positions
  }

  const hasMatch = knownPositions.some((pos) =>
    config.accepted_positions.includes(pos)
  );

  return hasMatch ? 100 : 0;
}

/**
 * Score graduation year fit (0-100).
 * 100 if in accepted years, 0 if not.
 */
export function scoreGradYearFit(
  recruit: Recruit,
  config: ProgramConfig
): number | null {
  if (recruit.graduation_year == null) {
    return null; // No grad year data
  }

  if (config.accepted_grad_years.length === 0) {
    return 100; // Coach accepts all years
  }

  return config.accepted_grad_years.includes(recruit.graduation_year) ? 100 : 0;
}

/**
 * Score profile completeness (0-100).
 * Simple ratio of extracted to total fields.
 */
export function scoreCompleteness(recruit: Recruit): number {
  if (recruit.fields_total === 0) return 0;
  return Math.round((recruit.fields_extracted / recruit.fields_total) * 100);
}

/**
 * Calculate bonus points for high-need positions and priority grad years.
 * Returns 0-10 bonus points.
 */
export function calculateBonus(
  recruit: Recruit,
  config: ProgramConfig
): { points: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  // High-need position bonus (up to 5 points) — per graduation year
  if (
    config.high_need_positions &&
    recruit.graduation_year != null
  ) {
    const yearKey = String(recruit.graduation_year);
    const yearPositions = config.high_need_positions[yearKey];
    if (yearPositions && yearPositions.length > 0) {
      for (const need of yearPositions) {
        if (recruit.positions.includes(need.position)) {
          // Higher rank (lower number) = more bonus
          const posBonus = Math.max(1, 6 - need.rank);
          points += posBonus;
          reasons.push(`+${posBonus} for high-need position ${need.position} in ${yearKey} (priority #${need.rank})`);
          break; // Only count best matching position
        }
      }
    }
  }

  // Priority grad year bonus (up to 5 points)
  if (
    config.priority_grad_years &&
    config.priority_grad_years.length > 0 &&
    recruit.graduation_year != null
  ) {
    for (const prio of config.priority_grad_years) {
      if (recruit.graduation_year === prio.year) {
        const yearBonus = Math.max(1, 6 - prio.rank);
        points += yearBonus;
        reasons.push(`+${yearBonus} for priority grad year ${prio.year} (priority #${prio.rank})`);
        break;
      }
    }
  }

  return { points: Math.min(10, points), reasons };
}
