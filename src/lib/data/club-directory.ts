/**
 * Gender-aware club-to-league lookup directory.
 *
 * Sources:
 *   - Boys: MLS NEXT, ECNL, NAL (updated JSON lists in src/lib/data/)
 *   - Girls: MLS NEXT, ECNL, DPL, GA (updated JSON lists in src/lib/data/)
 *
 * Each gender has its own curated directory. New tiers (NAL, DPL) map to 'regional'.
 * Priority chain within each list: highest tier > lower tiers
 */
import type { ClubLevel } from "@/types/database";
import boysData from "./updated-boys-club-list.json";
import girlsData from "./updated-girls-club-list.json";

// ---------------------------------------------------------------------------
// Helper: Normalize and map JSON leagues to ClubLevel enum
// ---------------------------------------------------------------------------

/**
 * Convert raw club name from JSON to normalized form (lowercase, etc.)
 */
function normalizeClubNameInternal(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-") // en-dash / em-dash → hyphen
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Map JSON league tier to ClubLevel enum value.
 * New tiers (NAL for boys, DPL for girls) map to 'regional' since they
 * don't have corresponding enum values yet.
 */
function mapTierToClubLevel(tier: string): ClubLevel {
  switch (tier.toLowerCase()) {
    case "mls_next":
      return "mls_next";
    case "ecnl":
      return "ecnl";
    case "ga":
      return "ga";
    case "nal":
    case "dpl":
      // Map new tiers to regional until enum expands
      return "regional";
    default:
      return "unknown";
  }
}

/**
 * Build lookup sets from JSON club lists for a given gender.
 * Returns an object mapping ClubLevel → Set of normalized club names.
 */
function buildClubLevelSets(
  data: typeof boysData | typeof girlsData
): Record<ClubLevel, Set<string>> {
  const sets: Record<ClubLevel, Set<string>> = {
    mls_next: new Set(),
    mls_next_academy: new Set(),
    mls_next_homegrown: new Set(),
    ecnl: new Set(),
    ecrl: new Set(),
    ga: new Set(),
    ga_aspire: new Set(),
    regional: new Set(),
    other: new Set(),
    unknown: new Set(),
  };

  for (const [tier, clubs] of Object.entries(data)) {
    const clubLevel = mapTierToClubLevel(tier);
    if (Array.isArray(clubs)) {
      for (const club of clubs) {
        sets[clubLevel].add(normalizeClubNameInternal(club));
      }
    }
  }

  return sets;
}

// Build lookup sets once at module load time for both genders
const boysSets = buildClubLevelSets(boysData);
const girlsSets = buildClubLevelSets(girlsData);

// ---------------------------------------------------------------------------
// Alias map — common abbreviations and name variants → canonical name
// Keep this consistent across both boys and girls directories
// ---------------------------------------------------------------------------
const CLUB_ALIASES: Record<string, string> = {
  // Common abbreviations
  "nycfc": "new york city fc",
  "nyfc": "new york city fc",
  "nyrb": "new york red bulls",
  "lafc": "los angeles football club",
  "pda": "players development academy",
  "slsg": "st. louis scott gallagher",
  "cesa": "carolina elite soccer academy",
  "mvla": "mvla soccer club",
  "ufa": "united futbol academy",
  "vda": "virginia development academy",
  "bwg": "blau weiss gottschee",
  "rsl": "real salt lake",

  // MLS team short names
  "inter miami": "inter miami cf",
  "atlanta united": "atlanta united fc",
  "fc cincy": "fc cincinnati",
  "sporting kc": "sporting kansas city",
  "columbus crew": "columbus crew sc",

  // Name variants across source PDFs
  "ac river": "a.c. river",
  "deanza force": "de anza force",
  "beachside of connecticut": "beachside soccer club connecticut",
  "charlotte independence sc": "charlotte independence soccer club",
  "chicago fire youth sc": "chicago fire fc",
  "city sc - san diego": "city sc san diego",
  "fc westchester": "fc westchester new york",
  "ideasport sa": "ideasport soccer academy",
  "img": "img academy",
  "la surf soccer club": "los angeles surf",
  "la surf sc": "los angeles surf",
  "los angeles soccer club": "los angeles sports club",
  "lamorinda soccer club": "lamorinda sc",
  "new york sc": "new york soccer club",
  "rochester ny fc": "rochester ny fc academy",
  "san francisco glens sc": "san francisco glens",
  "sf glens": "san francisco glens",
  "tsf academy": "tsf academy - nj",
  "valeo futbol club": "valeo fc",
  "midwest united fc": "midwest united",
  "loudoun soccer": "loudoun soccer club",
  "loudoun sc": "loudoun soccer club",
  "orlando city youth soccer": "orlando city youth sc",
  "vardar": "vardar soccer club",
  "houston dynamo youth": "houston dynamo",
  "king's hammer": "kings hammer cincinnati",
  "kings hammer": "kings hammer cincinnati",
  "kings hammer sc": "kings hammer cincinnati",
  "rsl-az": "rsl arizona",
  "rsl az": "rsl arizona",
  "slsg white": "st. louis scott gallagher",
  "st. louis scott gallagher (slsg)": "st. louis scott gallagher",
  "st. louis scott gallagher il": "st. louis scott gallagher",
  "st. louis scott gallagher st. charles": "st. louis scott gallagher",
  "tampa bay united rowdies": "tampa bay united",
  "colorado united": "colorado united sc",
  "downtown united sc": "downtown united soccer club",
  "fc tucson": "fc tucson youth soccer club",
  "galaxy sc": "galaxy soccer club",
  "long island sc": "long island soccer club",
  "louisiana elite": "louisiana elite sp",
  "mclean ys": "mclean youth soccer",
  "michigan jaguars fc": "michigan jaguars",
  "michigan tigers": "michigan tigers fc",
  "nashville united": "nashville united soccer academy",
  "nefc navy": "nefc",
  "nefc red": "nefc",
  "oakwood sc": "oakwood soccer club",
  "rhode island surf": "rhode island surf sc",
  "rochester nyfc youth": "rochester ny fc academy",
  "springfield youth club": "springfield syc",
  "the st. james football club": "the st. james",
  "triangle united": "triangle united soccer association",
  "va revolution": "virginia revolution sc",
  "western washington surf": "western washington surf sc",
  "westside metros": "westside metros fc",
  "broomfield sc": "broomfield soccer club",
  "cincinnati united premier gold": "cincinnati united premier soccer club",
  "space coast united sc": "space coast united",
  "hoover- vestavia soccer": "hoover-vestavia soccer",

  // Parenthetical variants from directory
  "gwinnett soccer academy (gsa)": "gwinnett soccer academy",
  "carolina elite soccer academy (cesa)": "carolina elite soccer academy",
  "united futbol academy (ufa)": "united futbol academy",
  "mountain view los altos soccer club": "mvla soccer club",
  "mountain view los altos (mvla) soccer club": "mvla soccer club",

  // En-dash variants from directory PDF
  "cedar stars academy \u2013 bergen": "cedar stars academy - bergen",
  "cedar stars academy \u2013 monmouth": "cedar stars academy - monmouth",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Normalize a club name: lowercase, trim, collapse whitespace, normalize dashes. */
export function normalizeClubName(name: string): string {
  return normalizeClubNameInternal(name);
}

/**
 * Look up the league tier for a club by name, using the directory for a specific gender.
 * Returns the highest-priority match within the gender's list, or "unknown" if not found.
 *
 * @param clubTeam Club name to look up (e.g., "NYCFC Academy")
 * @param isBoys true for boys directory, false for girls directory; defaults to true
 * @returns The club level (e.g., "mls_next", "ecnl", "ga", "regional") or "unknown" if not found
 */
export function lookupClubLevel(
  clubTeam: string | null | undefined,
  isBoys: boolean = true
): ClubLevel {
  if (!clubTeam || !clubTeam.trim()) return "unknown";

  let normalized = normalizeClubNameInternal(clubTeam);

  // Resolve alias if one exists
  if (CLUB_ALIASES[normalized]) {
    normalized = CLUB_ALIASES[normalized];
  }

  // Debugging hooks for failing lookups
  // (No debug logging) lookups should be quiet in tests

  // Select the appropriate directory based on gender
  const sets = isBoys ? boysSets : girlsSets;

  // Check tiers in priority order: highest tier first
  // Priority chain: mls_next > ecnl > regional > ga > other
  const inMls = sets.mls_next.has(normalized);
  const inEcnl = sets.ecnl.has(normalized);
  const inRegional = sets.regional.has(normalized);
  const inGa = sets.ga.has(normalized);
  const inOther = sets.other.has(normalized);

  // Debug specific case logging
  // No debug logging in normal operation

  if (inMls) return "mls_next";
  if (inEcnl) return "ecnl";
  if (inRegional) return "regional";
  if (inGa) return "ga";
  if (inOther) return "other";

  return "unknown";
}
