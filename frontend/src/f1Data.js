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

export function getTeamColor(driver) {
  return TEAM_COLORS[driver]?.color || "#666";
}

export function getDriverFlag(driver) {
  return DRIVER_FLAGS[driver] || "🏁";
}

export function getTeamName(driver) {
  return TEAM_COLORS[driver]?.team || "Unknown";
}