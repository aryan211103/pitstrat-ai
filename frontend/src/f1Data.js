// F1 team colors (2022-2025 official)
export const TEAM_COLORS = {
  // Red Bull
  VER: { team: "Red Bull", color: "#0600ef", accent: "#1e1e8a" },
  PER: { team: "Red Bull", color: "#0600ef", accent: "#1e1e8a" },

  // Ferrari
  LEC: { team: "Ferrari", color: "#dc0000", accent: "#8a0000" },
  SAI: { team: "Ferrari", color: "#dc0000", accent: "#8a0000" },

  // Mercedes
  HAM: { team: "Mercedes", color: "#00d2be", accent: "#008272" },
  RUS: { team: "Mercedes", color: "#00d2be", accent: "#008272" },

  // McLaren
  NOR: { team: "McLaren", color: "#ff8700", accent: "#a85800" },
  PIA: { team: "McLaren", color: "#ff8700", accent: "#a85800" },
  RIC: { team: "McLaren", color: "#ff8700", accent: "#a85800" },

  // Aston Martin
  ALO: { team: "Aston Martin", color: "#006f62", accent: "#003d35" },
  STR: { team: "Aston Martin", color: "#006f62", accent: "#003d35" },
  VET: { team: "Aston Martin", color: "#006f62", accent: "#003d35" },

  // Alpine
  GAS: { team: "Alpine", color: "#0090ff", accent: "#0060a8" },
  OCO: { team: "Alpine", color: "#0090ff", accent: "#0060a8" },

  // Williams
  ALB: { team: "Williams", color: "#005aff", accent: "#003ba8" },
  SAR: { team: "Williams", color: "#005aff", accent: "#003ba8" },
  LAT: { team: "Williams", color: "#005aff", accent: "#003ba8" },

  // RB / AlphaTauri
  TSU: { team: "RB", color: "#6692ff", accent: "#4a6ec0" },
  DEV: { team: "RB", color: "#6692ff", accent: "#4a6ec0" },
  LAW: { team: "RB", color: "#6692ff", accent: "#4a6ec0" },
  HAD: { team: "RB", color: "#6692ff", accent: "#4a6ec0" },

  // Kick Sauber / Alfa Romeo
  BOT: { team: "Sauber", color: "#52e252", accent: "#2a8a2a" },
  ZHO: { team: "Sauber", color: "#52e252", accent: "#2a8a2a" },
  BOR: { team: "Sauber", color: "#52e252", accent: "#2a8a2a" },

  // Haas
  MAG: { team: "Haas", color: "#b6babd", accent: "#6e7274" },
  HUL: { team: "Haas", color: "#b6babd", accent: "#6e7274" },
  MSC: { team: "Haas", color: "#b6babd", accent: "#6e7274" },
  BEA: { team: "Haas", color: "#b6babd", accent: "#6e7274" },

  // Mercedes (2025 rookie)
  ANT: { team: "Mercedes", color: "#00d2be", accent: "#008272" },

  // Alpine (2025)
  COL: { team: "Alpine", color: "#0090ff", accent: "#0060a8" },
  DOO: { team: "Alpine", color: "#0090ff", accent: "#0060a8" },
};

// Driver country flags (using emoji)
export const DRIVER_FLAGS = {
  VER: "🇳🇱", // Netherlands
  PER: "🇲🇽", // Mexico
  LEC: "🇲🇨", // Monaco
  SAI: "🇪🇸", // Spain
  HAM: "🇬🇧", // UK
  RUS: "🇬🇧", // UK
  NOR: "🇬🇧", // UK
  PIA: "🇦🇺", // Australia
  RIC: "🇦🇺", // Australia
  ALO: "🇪🇸", // Spain
  STR: "🇨🇦", // Canada
  VET: "🇩🇪", // Germany
  GAS: "🇫🇷", // France
  OCO: "🇫🇷", // France
  ALB: "🇹🇭", // Thailand
  SAR: "🇺🇸", // USA
  LAT: "🇨🇦", // Canada
  TSU: "🇯🇵", // Japan
  DEV: "🇳🇱", // Netherlands
  LAW: "🇳🇿", // New Zealand
  BOT: "🇫🇮", // Finland
  ZHO: "🇨🇳", // China
  MAG: "🇩🇰", // Denmark
  HUL: "🇩🇪", // Germany
  MSC: "🇩🇪", // Germany
  // 2025 rookies
  HAD: "🇫🇷", // France (Hadjar)
  BEA: "🇬🇧", // UK (Bearman)
  COL: "🇦🇷", // Argentina (Colapinto)
  BOR: "🇧🇷", // Brazil (Bortoleto)
  ANT: "🇮🇹", // Italy (Antonelli)
  DOO: "🇦🇺", // Australia (Doohan)
};

export function getTeamColor(driver, year, round) {
  const override = _findOverride(driver, year, round);
  if (override) return override.color;
  return TEAM_COLORS[driver]?.color || "#666";
}

export function getDriverFlag(driver) {
  return DRIVER_FLAGS[driver] || "🏁";
}

export function getTeamName(driver, year, round) {
  const override = _findOverride(driver, year, round);
  if (override) return override.team;
  return TEAM_COLORS[driver]?.team || "Unknown";
}

// Round-aware lookup. Each override entry can have an optional `from_round`.
function _findOverride(driver, year, round) {
  if (!year) return null;
  const yearMap = TEAM_OVERRIDES[year];
  if (!yearMap) return null;
  const entries = yearMap[driver];
  if (!entries) return null;
  // entries is either a single team object or an array of {from_round, ...team}
  if (!Array.isArray(entries)) return entries;
  // Find the latest entry whose from_round <= current round
  const r = round || 99;
  let best = null;
  for (const e of entries) {
    if ((e.from_round || 1) <= r) {
      if (!best || (e.from_round || 1) > (best.from_round || 1)) best = e;
    }
  }
  return best;
}

// Team color shortcuts (so the override map below stays readable)
const _TEAM = {
  Williams: { color: "#005aff", accent: "#003a99" },
  Ferrari: { color: "#dc0000", accent: "#8a0000" },
  Mercedes: { color: "#00d2be", accent: "#008272" },
  RedBull: { color: "#0600ef", accent: "#1e1e8a" },
  RacingBulls: { color: "#6692ff", accent: "#4a6ec0" },
  Alpine: { color: "#0090ff", accent: "#0060a8" },
  AstonMartin: { color: "#006f62", accent: "#004640" },
  McLaren: { color: "#ff8700", accent: "#a85800" },
  Sauber: { color: "#52e252", accent: "#2a8a2a" },
  Haas: { color: "#b6babd", accent: "#6e7274" },
  AlphaTauri: { color: "#2b4562", accent: "#1a2a3d" },
  AlfaRomeo: { color: "#900000", accent: "#5a0000" },
};

// All non-default team assignments per (year, round) since 2022
// Drivers not listed here use their base TEAM_COLORS mapping
export const TEAM_OVERRIDES = {
  // 2023 — Nyck de Vries started at AlphaTauri, replaced mid-season by Ricciardo from round 11 (Hungary)
  2023: {
    DEV: { team: "AlphaTauri", ..._TEAM.AlphaTauri },
    RIC: [
      // RIC was at McLaren in 2022, here we override for 2023 only — joined AlphaTauri mid-season
      { from_round: 11, team: "AlphaTauri", ..._TEAM.AlphaTauri },
    ],
  },

  // 2024 — Hulkenberg/Magnussen at Haas, Sargeant at Williams replaced by Colapinto from round 16 (Italian GP),
  // Ricciardo dropped from RB after Singapore (round 18), replaced by Lawson from round 19
  2024: {
    COL: [{ from_round: 16, team: "Williams", ..._TEAM.Williams }],
    LAW: [{ from_round: 19, team: "RB", ..._TEAM.RacingBulls }],
  },

  // 2025 — biggest reshuffle year
  // HAM Mercedes → Ferrari
  // SAI Ferrari → Williams
  // HUL Haas → Sauber
  // BOT/ZHO out of Sauber; replaced by HUL + BOR
  // BEA Haas full-time
  // LAW promoted to Red Bull at start, demoted back to Racing Bulls from round 3 (Japan)
  // TSU Racing Bulls → Red Bull from round 3
  // DOO at Alpine, replaced by COL from round 7 (Imola)
  // ANT Mercedes rookie
  // HAD Racing Bulls rookie
  2025: {
    HAM: { team: "Ferrari", ..._TEAM.Ferrari },
    SAI: { team: "Williams", ..._TEAM.Williams },
    HUL: { team: "Sauber", ..._TEAM.Sauber },
    BEA: { team: "Haas", ..._TEAM.Haas },
    BOR: { team: "Sauber", ..._TEAM.Sauber },
    ANT: { team: "Mercedes", ..._TEAM.Mercedes },
    HAD: { team: "RB", ..._TEAM.RacingBulls },
    LAW: [
      { from_round: 1, team: "Red Bull", ..._TEAM.RedBull },
      { from_round: 3, team: "RB", ..._TEAM.RacingBulls },
    ],
    TSU: [
      { from_round: 1, team: "RB", ..._TEAM.RacingBulls },
      { from_round: 3, team: "Red Bull", ..._TEAM.RedBull },
    ],
    DOO: [{ from_round: 1, team: "Alpine", ..._TEAM.Alpine }],
    COL: [{ from_round: 7, team: "Alpine", ..._TEAM.Alpine }],
  },
};