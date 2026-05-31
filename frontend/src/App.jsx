import { useState, useEffect, useRef } from "react";
import { getTeamColor, getDriverFlag, getTeamName } from "./f1Data";

const API = "http://localhost:8000";

const COMPOUNDS = {
  SOFT: { color: "#e8002d", label: "S" },
  MEDIUM: { color: "#ffd700", label: "M" },
  HARD: { color: "#ebebeb", label: "H" },
  INTERMEDIATE: { color: "#39b54a", label: "I" },
  WET: { color: "#0067ff", label: "W" },
  UNKNOWN: { color: "#555", label: "?" },
};

const TYRE_LIFE = {
  SOFT: "15–25 laps",
  MEDIUM: "25–40 laps",
  HARD: "40–65 laps",
};

function TireBadge({ compound, size = 26 }) {
  const c = COMPOUNDS[compound] || COMPOUNDS.UNKNOWN;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      background: c.color,
      color: compound === "MEDIUM" || compound === "HARD" ? "#111" : "#fff",
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 700, fontSize: size * 0.45,
      boxShadow: `0 0 8px ${c.color}55`,
      flexShrink: 0,
    }}>{c.label}</span>
  );
}

function StintBar({ stint, totalLaps, isLeader }) {
  const c = COMPOUNDS[stint.compound] || COMPOUNDS.UNKNOWN;
  const left = ((stint.lap_start - 1) / totalLaps) * 100;
  const width = (stint.total_laps / totalLaps) * 100;
  const [hover, setHover] = useState(false);

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
        height: "100%",
        background: `linear-gradient(180deg, ${c.color}ff, ${c.color}cc 50%, ${c.color}aa)`,
        borderRadius: 2,
        borderRight: "2px solid #05050d",
        boxShadow: isLeader ? `0 0 10px ${c.color}aa` : hover ? `0 0 8px ${c.color}88` : "inset 0 -2px 0 rgba(0,0,0,0.25)",
        transition: "box-shadow 0.15s",
        cursor: "pointer",
        zIndex: hover ? 5 : 1,
      }}
    >
      {/* Tire compound circle at the start of the stint */}
      {width > 4 && (
        <div style={{
          position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: c.color, border: "1.5px solid rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 9,
          color: stint.compound === "HARD" ? "#222" : "#000",
          boxShadow: "0 0 4px rgba(0,0,0,0.5)",
        }}>{c.label}</div>
      )}

      {/* Hover tooltip */}
      {hover && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)", background: "#0a0a1a",
          border: `1px solid ${c.color}66`, borderRadius: 6,
          padding: "8px 12px", whiteSpace: "nowrap", zIndex: 100,
          boxShadow: `0 6px 24px rgba(0,0,0,0.8), 0 0 0 1px ${c.color}33`,
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          <div style={{ fontSize: 10, color: c.color, fontWeight: 800, letterSpacing: 1.5 }}>
            {stint.compound} · LAPS {stint.laps}
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
            {stint.total_laps} laps · avg <span className="mono">{stint.avg_lap_time?.toFixed(2) || "—"}</span>s
          </div>
          {typeof stint.degradation_rate_per_lap === "number" && (
            <div style={{ fontSize: 10, color: stint.degradation_rate_per_lap > 0 ? "#ff5566" : "#00ff88", marginTop: 2 }}>
              deg {stint.degradation_rate_per_lap > 0 ? "+" : ""}<span className="mono">{stint.degradation_rate_per_lap.toFixed(3)}</span>s/lap
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DriverRow({ driver, finish_position, stints, totalLaps, onSelect, index, safetyCarRanges, vscRanges, year, round }) {
  const teamColor = getTeamColor(driver, year, round);
  const flag = getDriverFlag(driver);
  const teamName = getTeamName(driver, year, round);
  const [hover, setHover] = useState(false);
  const isLeader = finish_position === 1;
  const isPodium = finish_position <= 3;

  return (
    <div onClick={() => onSelect(driver)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 3, cursor: "pointer",
        padding: "10px 14px 10px 0", borderRadius: 6,
        background: hover
          ? `linear-gradient(90deg, ${teamColor}22, transparent 70%)`
          : isLeader
          ? `linear-gradient(90deg, rgba(255, 215, 0, 0.06), transparent 30%)`
          : "transparent",
        position: "relative",
        animation: `slideIn 0.3s ease ${index * 0.02}s both`,
      }}
    >
      {/* Team color stripe — thicker */}
      <div style={{
        width: 4, height: 36, background: teamColor,
        boxShadow: hover ? `0 0 12px ${teamColor}` : "none",
        transition: "box-shadow 0.2s", borderRadius: 1,
      }} />

      {/* Position badge */}
      <div style={{
        width: 38, textAlign: "center",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 15,
        color: isLeader ? "#0a0a14" : isPodium ? "#0a0a14" : "#888",
        background: isLeader ? "#ffd700" : isPodium ? "#c0c0c0" : "transparent",
        borderRadius: 4, padding: "3px 0",
        boxShadow: isLeader ? "0 0 14px rgba(255, 215, 0, 0.5)" : "none",
      }}>P{finish_position}</div>

      <span style={{ fontSize: 18, lineHeight: 1, filter: "saturate(1.2)" }}>{flag}</span>

      <span className="driver-code" style={{
        width: 50, textAlign: "left",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 17,
        color: hover ? teamColor : "#f5f5fa",
        letterSpacing: 1,
        transition: "color 0.2s",
        textShadow: isLeader ? "0 0 12px rgba(255,215,0,0.4)" : "none",
      }}>{driver}</span>

      <span style={{
        width: 110, fontSize: 10, color: hover ? "#aaa" : "#555",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
        transition: "color 0.2s",
      }}>{teamName}</span>

      <div style={{
        flex: 1, position: "relative", height: 24,
        background: "#05050d", borderRadius: 4, overflow: "visible",
        border: "1px solid #1a1a30",
      }}>
        {/* Safety car bands — yellow translucent overlay */}
        {(safetyCarRanges || []).map((r, i) => {
          const left = ((r.start - 1) / totalLaps) * 100;
          const width = ((r.end - r.start + 1) / totalLaps) * 100;
          return (
            <div key={`sc-${i}`} style={{
              position: "absolute",
              left: `${left}%`, width: `${width}%`,
              top: -3, bottom: -3,
              background: "repeating-linear-gradient(45deg, rgba(255, 200, 0, 0.18) 0 6px, rgba(255, 200, 0, 0.10) 6px 12px)",
              borderLeft: "1.5px solid rgba(255, 200, 0, 0.55)",
              borderRight: "1.5px solid rgba(255, 200, 0, 0.55)",
              pointerEvents: "none",
              zIndex: 0,
            }} />
          );
        })}
        {/* VSC bands — purple translucent overlay */}
        {(vscRanges || []).map((r, i) => {
          const left = ((r.start - 1) / totalLaps) * 100;
          const width = ((r.end - r.start + 1) / totalLaps) * 100;
          return (
            <div key={`vsc-${i}`} style={{
              position: "absolute",
              left: `${left}%`, width: `${width}%`,
              top: -3, bottom: -3,
              background: "repeating-linear-gradient(45deg, rgba(180, 140, 255, 0.14) 0 6px, rgba(180, 140, 255, 0.08) 6px 12px)",
              borderLeft: "1.5px solid rgba(180, 140, 255, 0.45)",
              borderRight: "1.5px solid rgba(180, 140, 255, 0.45)",
              pointerEvents: "none",
              zIndex: 0,
            }} />
          );
        })}
        {/* Lap tick marks every 10 laps */}
        {Array.from({ length: Math.floor(totalLaps / 10) }, (_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${((i + 1) * 10 / totalLaps) * 100}%`,
            top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }} />
        ))}
        {stints.map((s, i) => <StintBar key={i} stint={s} totalLaps={totalLaps} isLeader={isLeader} />)}
      </div>

      <span style={{
        width: 42, textAlign: "center",
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14,
        color: hover ? teamColor : "#888", letterSpacing: 0.5,
        transition: "color 0.2s",
      }}>{stints.length - 1}<span style={{ color: "#333", marginLeft: 2 }}>PIT{stints.length - 1 !== 1 ? "S" : ""}</span></span>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16, animation: "slideIn 0.2s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #e8002d, #8a001a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
          fontSize: 12, color: "#fff", marginRight: 10, flexShrink: 0, marginTop: 2,
          boxShadow: "0 0 12px rgba(232, 0, 45, 0.3), inset 0 0 0 1px rgba(255,255,255,0.1)",
          letterSpacing: 0.5,
        }}>PW</div>
      )}
      <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
        {!isUser && (
          <div style={{
            fontSize: 9, color: "#666",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 2,
          }}>PITSTRAT AI · RACE ENGINEER</div>
        )}
        <div style={{
          padding: "12px 16px",
          background: isUser
            ? "linear-gradient(135deg, rgba(232, 0, 45, 0.12), rgba(232, 0, 45, 0.06))"
            : "#0f0f1e",
          border: `1px solid ${isUser ? "#e8002d44" : "#252545"}`,
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          color: "#e8e8f0", fontSize: 14, lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          boxShadow: isUser ? "0 0 16px rgba(232, 0, 45, 0.08)" : "0 2px 8px rgba(0,0,0,0.3)",
          fontFamily: "'DM Sans', sans-serif",
        }}>{msg.content}</div>
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#13132a", border: "1px solid #252545",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
          fontSize: 12, color: "#888", marginLeft: 10, flexShrink: 0, marginTop: 2,
        }}>YOU</div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "8px 4px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#e8002d",
          animation: "bounce 1.1s infinite", animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </div>
  );
}

// F1 car SVG silhouette — used as background brand element
function F1CarSilhouette({ opacity = 0.06, width = 800 }) {
  return (
    <svg viewBox="0 0 800 200" style={{ width, height: "auto", opacity, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="carGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e8002d" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e8002d" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Speed lines */}
      <g stroke="url(#carGradient)" strokeWidth="1" fill="none">
        <line x1="0" y1="80" x2="120" y2="80" />
        <line x1="0" y1="100" x2="100" y2="100" />
        <line x1="0" y1="120" x2="140" y2="120" />
        <line x1="0" y1="140" x2="90" y2="140" />
      </g>

      {/* Front wing */}
      <path d="M 140 100 L 200 95 L 220 90 L 250 88 L 250 110 L 220 112 L 200 110 L 140 105 Z"
        fill="#e8002d" opacity="0.8" />

      {/* Nose cone */}
      <path d="M 220 95 L 320 85 L 340 90 L 340 105 L 320 110 L 220 102 Z" fill="#e8002d" />

      {/* Front tyre */}
      <ellipse cx="320" cy="110" rx="32" ry="38" fill="#0a0a0a" stroke="#e8002d" strokeWidth="2" />
      <ellipse cx="320" cy="110" rx="18" ry="22" fill="#1a1a2a" />

      {/* Cockpit / sidepod */}
      <path d="M 340 75 L 480 70 L 540 80 L 560 90 L 560 110 L 540 120 L 480 130 L 340 125 Z"
        fill="#e8002d" opacity="0.9" />

      {/* Cockpit halo */}
      <path d="M 410 50 Q 420 35, 450 35 Q 480 35, 490 50 L 490 75 L 410 75 Z"
        fill="none" stroke="#1a1a2a" strokeWidth="3" />
      <ellipse cx="450" cy="60" rx="35" ry="12" fill="#000" opacity="0.6" />

      {/* Rear tyre */}
      <ellipse cx="600" cy="110" rx="36" ry="42" fill="#0a0a0a" stroke="#e8002d" strokeWidth="2" />
      <ellipse cx="600" cy="110" rx="20" ry="25" fill="#1a1a2a" />

      {/* Rear wing */}
      <path d="M 640 65 L 720 60 L 740 70 L 740 95 L 720 100 L 640 95 Z" fill="#e8002d" />
      <rect x="640" y="60" width="100" height="4" fill="#e8002d" />

      {/* Speed lines back */}
      <g stroke="url(#carGradient)" strokeWidth="1" fill="none" transform="translate(0, 0) scale(-1, 1) translate(-800, 0)">
        <line x1="0" y1="80" x2="60" y2="80" />
        <line x1="0" y1="100" x2="50" y2="100" />
        <line x1="0" y1="120" x2="70" y2="120" />
      </g>
    </svg>
  );
}

// Race selector grouped by year
function RaceSelector({ races, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Group races by year, descending
  const grouped = races.reduce((acc, r) => {
    if (!acc[r.year]) acc[r.year] = [];
    acc[r.year].push(r);
    return acc;
  }, {});
  const years = Object.keys(grouped).sort((a, b) => b - a);

  const selected = races.find(r => `${r.year}-${r.round_number}` === value);
  const displayText = selected
    ? `${selected.year} R${String(selected.round_number).padStart(2, "0")} — ${selected.race_name}`
    : "Select a race...";

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 280 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", textAlign: "left", padding: "8px 14px",
        background: "#13132a", border: "1px solid #252545",
        borderRadius: 6, color: selected ? "#e8e8f0" : "#555",
        fontSize: 13, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayText}</span>
        <span style={{
          color: "#e8002d", marginLeft: 8, transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "rotate(0)",
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, left: 0,
          background: "#0a0a1a", border: "1px solid #2e2e5a",
          borderRadius: 8, maxHeight: 460, overflowY: "auto",
          boxShadow: "0 12px 36px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,0,45,0.2)",
          zIndex: 100, animation: "slideIn 0.15s ease",
        }}>
          {years.map(year => (
            <div key={year}>
              <div style={{
                padding: "8px 14px", background: "#13132a",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800, fontSize: 12, letterSpacing: 2,
                color: "#e8002d",
                borderTop: "1px solid #1a1a30",
                position: "sticky", top: 0, zIndex: 1,
              }}>{year} SEASON · {grouped[year].length} RACES</div>
              {grouped[year].map(r => {
                const isSelected = `${r.year}-${r.round_number}` === value;
                return (
                  <div key={`${r.year}-${r.round_number}`}
                    onClick={() => {
                      onChange(`${r.year}-${r.round_number}`);
                      setOpen(false);
                    }}
                    style={{
                      padding: "8px 14px", cursor: "pointer",
                      fontSize: 13, color: isSelected ? "#e8002d" : "#ccc",
                      background: isSelected ? "#e8002d11" : "transparent",
                      display: "flex", gap: 10, alignItems: "center",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#13132a"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 28, fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700, fontSize: 11, color: "#555", letterSpacing: 0.5,
                    }}>R{String(r.round_number).padStart(2, "0")}</span>
                    <span style={{ flex: 1 }}>{r.race_name}</span>
                    {isSelected && <span style={{ color: "#e8002d", fontSize: 11 }}>●</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Predicted vs Actual scatter plot — SVG-based
function ScatterPlot({ data }) {
  const width = 700;
  const height = 360;
  const margin = { top: 16, right: 16, bottom: 36, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Bounds
  const xs = data.map(d => d.actual);
  const ys = data.map(d => d.predicted);
  const minV = Math.min(...xs, ...ys);
  const maxV = Math.max(...xs, ...ys);
  const range = maxV - minV;
  const pad = range * 0.05;
  const lo = minV - pad;
  const hi = maxV + pad;

  const xScale = v => ((v - lo) / (hi - lo)) * innerW;
  const yScale = v => innerH - ((v - lo) / (hi - lo)) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Diagonal perfect-prediction line */}
        <line x1={xScale(lo)} y1={yScale(lo)} x2={xScale(hi)} y2={yScale(hi)}
          stroke="#e8002d" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />

        {/* Axes */}
        <line x1="0" y1={innerH} x2={innerW} y2={innerH} stroke="#252545" />
        <line x1="0" y1="0" x2="0" y2={innerH} stroke="#252545" />

        {/* Ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const val = lo + t * (hi - lo);
          return (
            <g key={t}>
              <text x={xScale(val)} y={innerH + 16} fontSize="9" fill="#555" textAnchor="middle" fontFamily="Barlow Condensed">{val.toFixed(0)}s</text>
              <text x={-8} y={yScale(val) + 3} fontSize="9" fill="#555" textAnchor="end" fontFamily="Barlow Condensed">{val.toFixed(0)}s</text>
            </g>
          );
        })}

        {/* Data points */}
        {data.map((d, i) => (
          <circle key={i} cx={xScale(d.actual)} cy={yScale(d.predicted)}
            r="2.5" fill="#00ff88" opacity="0.5" />
        ))}

        {/* Labels */}
        <text x={innerW / 2} y={innerH + 30} fontSize="11" fill="#888" textAnchor="middle" fontFamily="Barlow Condensed" letterSpacing="1">ACTUAL LAP TIME</text>
        <text x={-innerH / 2} y={-32} fontSize="11" fill="#888" textAnchor="middle" fontFamily="Barlow Condensed" letterSpacing="1" transform={`rotate(-90)`}>PREDICTED LAP TIME</text>
      </g>
    </svg>
  );
}

// Residual histogram — SVG-based
function ResidualHistogram({ data }) {
  const width = 700;
  const height = 200;
  const margin = { top: 16, right: 16, bottom: 36, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxCount = Math.max(...data.map(d => d.count));
  const barWidth = innerW / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Zero line */}
        {(() => {
          // Find zero index
          const zeroIdx = data.findIndex(d => d.bin_start >= 0);
          if (zeroIdx > 0) {
            return <line x1={zeroIdx * barWidth} y1="0" x2={zeroIdx * barWidth} y2={innerH}
              stroke="#e8002d" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />;
          }
        })()}

        {data.map((d, i) => {
          const h = (d.count / maxCount) * innerH;
          const x = i * barWidth;
          const y = innerH - h;
          const isCenter = d.bin_start >= -1 && d.bin_end <= 1;
          return (
            <rect key={i} x={x + 1} y={y} width={barWidth - 2} height={h}
              fill={isCenter ? "#00ff88" : "#e8002d"} opacity="0.7" />
          );
        })}

        {/* Axes */}
        <line x1="0" y1={innerH} x2={innerW} y2={innerH} stroke="#252545" />

        {/* X axis labels */}
        {[-15, -10, -5, 0, 5, 10, 15].map(v => {
          const idx = data.findIndex(d => d.bin_start >= v);
          if (idx < 0) return null;
          const x = idx * barWidth;
          return (
            <text key={v} x={x} y={innerH + 16} fontSize="9" fill="#555" textAnchor="middle" fontFamily="Barlow Condensed">{v >= 0 ? "+" : ""}{v}s</text>
          );
        })}

        <text x={innerW / 2} y={innerH + 30} fontSize="11" fill="#888" textAnchor="middle" fontFamily="Barlow Condensed" letterSpacing="1">RESIDUAL (PREDICTED − ACTUAL)</text>
      </g>
    </svg>
  );
}

// Strategy battle results — actual race head-to-head
function BattleResults({ result }) {
  const { driver_a, driver_b, final_gap, lap_comparison, key_moments, total_laps, year, round_number } = result;
  const aColor = getTeamColor(driver_a.driver, year, round_number);
  const bColor = getTeamColor(driver_b.driver, year, round_number);
  const winner = final_gap < 0 ? driver_a : driver_b;
  const loser = final_gap < 0 ? driver_b : driver_a;
  const winnerColor = final_gap < 0 ? aColor : bColor;
  const absGap = Math.abs(final_gap);

  // Build delta curve SVG
  const validDeltas = lap_comparison.filter(l => l.cum_delta !== null);
  const maxAbs = Math.max(...validDeltas.map(l => Math.abs(l.cum_delta)), 1);
  const W = 800, H = 220, padX = 50, padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const pathPoints = validDeltas.map(l => {
    const x = padX + ((l.lap - 1) / (total_laps - 1)) * innerW;
    const y = padY + innerH / 2 - (l.cum_delta / maxAbs) * (innerH / 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
        {/* Driver A */}
        <div style={{
          background: `linear-gradient(135deg, ${aColor}15, ${aColor}05)`,
          border: `1px solid ${aColor}55`, borderRadius: 10,
          padding: "18px 22px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: aColor, boxShadow: `0 0 12px ${aColor}88` }} />
          <div style={{ fontSize: 10, color: aColor, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>DRIVER A</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{getDriverFlag(driver_a.driver)}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#fff", letterSpacing: 1 }}>{driver_a.driver}</span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>P{driver_a.final_position} · {driver_a.pit_count} PIT{driver_a.pit_count !== 1 ? "S" : ""}</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 12, fontFamily: "JetBrains Mono, monospace" }}>{driver_a.strategy}</div>
        </div>

        {/* Final gap */}
        <div style={{
          background: "#0f0f1e", border: "1px solid #ffd70044",
          borderRadius: 10, padding: "18px 22px",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          boxShadow: "0 0 24px rgba(255, 215, 0, 0.05)",
        }}>
          <div style={{ fontSize: 10, color: "#ffd700", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>FINAL GAP</div>
          <div className="mono" style={{
            fontWeight: 700, fontSize: 36, lineHeight: 1, color: winnerColor,
            textShadow: `0 0 16px ${winnerColor}66`,
          }}>{absGap.toFixed(2)}s</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {winner.driver} ahead of {loser.driver}
          </div>
        </div>

        {/* Driver B */}
        <div style={{
          background: `linear-gradient(135deg, ${bColor}15, ${bColor}05)`,
          border: `1px solid ${bColor}55`, borderRadius: 10,
          padding: "18px 22px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: bColor, boxShadow: `0 0 12px ${bColor}88` }} />
          <div style={{ fontSize: 10, color: bColor, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>DRIVER B</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{getDriverFlag(driver_b.driver)}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#fff", letterSpacing: 1 }}>{driver_b.driver}</span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>P{driver_b.final_position} · {driver_b.pit_count} PIT{driver_b.pit_count !== 1 ? "S" : ""}</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 12, fontFamily: "JetBrains Mono, monospace" }}>{driver_b.strategy}</div>
        </div>
      </div>

      {/* Lap-by-lap delta chart */}
      <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px", marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 14 }}>
          CUMULATIVE TIME DELTA · <span style={{ color: aColor }}>{driver_a.driver}</span> vs <span style={{ color: bColor }}>{driver_b.driver}</span> (negative = {driver_a.driver} ahead)
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
          {/* Zero line */}
          <line x1={padX} y1={padY + innerH / 2} x2={padX + innerW} y2={padY + innerH / 2}
            stroke="#252545" strokeDasharray="3,3" />

          {/* Lap tick marks */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const x = padX + t * innerW;
            const lap = Math.round(1 + t * (total_laps - 1));
            return (
              <g key={t}>
                <line x1={x} y1={padY} x2={x} y2={padY + innerH} stroke="#1a1a30" />
                <text x={x} y={padY + innerH + 16} fontSize="9" fill="#555" textAnchor="middle" fontFamily="Barlow Condensed" letterSpacing="0.5">L{lap}</text>
              </g>
            );
          })}

          {/* Delta polyline */}
          <polyline points={pathPoints} fill="none" stroke={aColor} strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 4px ${aColor}88)` }} />

          {/* Y labels */}
          <text x={padX - 8} y={padY + 4} fontSize="9" fill="#555" textAnchor="end" fontFamily="Barlow Condensed">-{maxAbs.toFixed(0)}s</text>
          <text x={padX - 8} y={padY + innerH / 2 + 3} fontSize="9" fill="#555" textAnchor="end" fontFamily="Barlow Condensed">0s</text>
          <text x={padX - 8} y={padY + innerH + 4} fontSize="9" fill="#555" textAnchor="end" fontFamily="Barlow Condensed">+{maxAbs.toFixed(0)}s</text>
        </svg>
      </div>

      {/* Key moments */}
      {key_moments?.length > 0 && (
        <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 12 }}>KEY MOMENTS · BIGGEST LAP-BY-LAP DELTAS</div>
          {key_moments.map(m => (
            <div key={m.lap} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "8px 12px", borderRadius: 6, marginBottom: 4,
              background: "#13132a",
            }}>
              <span className="mono" style={{ width: 50, color: "#ffd700", fontSize: 13, fontWeight: 700 }}>LAP {m.lap}</span>
              <span style={{ color: aColor, fontSize: 12, fontFamily: "JetBrains Mono, monospace", width: 80 }}>{m.lap_time_a?.toFixed(3)}s</span>
              <span style={{ color: "#444" }}>vs</span>
              <span style={{ color: bColor, fontSize: 12, fontFamily: "JetBrains Mono, monospace", width: 80 }}>{m.lap_time_b?.toFixed(3)}s</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{
                fontSize: 14, fontWeight: 700,
                color: m.delta_lap < 0 ? aColor : bColor,
              }}>{m.delta_lap > 0 ? "+" : ""}{m.delta_lap?.toFixed(3)}s</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// What-if compare — run simulations for multiple drivers
function WhatIfCompare({ raceData, selectedRace }) {
  const [drivers, setDrivers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  function addDriver() {
    if (drivers.length >= 3 || !raceData) return;
    const used = new Set(drivers.map(d => d.driver));
    const available = raceData.drivers?.find(d => !used.has(d.driver));
    if (!available) return;
    setDrivers([...drivers, {
      driver: available.driver,
      start_compound: available.start_compound || "MEDIUM",
      pit_stops: (available.pit_stops || []).map(p => ({ lap: p.lap, compound: p.to })),
    }]);
    setResults(null);
  }

  function removeDriver(idx) {
    setDrivers(drivers.filter((_, i) => i !== idx));
    setResults(null);
  }

  function updateDriver(idx, changes) {
    const next = [...drivers];
    next[idx] = { ...next[idx], ...changes };
    setDrivers(next);
    setResults(null);
  }

  async function runAll() {
    if (drivers.length < 2 || !selectedRace) return;
    setLoading(true);
    setResults(null);
    try {
      const r = await fetch(`${API}/simulate_multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedRace.year,
          round_number: selectedRace.round_number,
          drivers: drivers.map(d => ({
            year: selectedRace.year,
            round_number: selectedRace.round_number,
            driver: d.driver,
            start_compound: d.start_compound,
            pit_stops: d.pit_stops,
          })),
        }),
      });
      const data = await r.json();
      setResults(data);
    } catch {
      setResults({ error: "Simulation failed" });
    }
    setLoading(false);
  }

  if (!selectedRace) {
    return <div style={{ color: "#e8002d", fontSize: 13, padding: 14 }}>← Pick a race from the dropdown above</div>;
  }

  return (
    <>
      <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
            DRIVERS ({drivers.length}/3)
          </div>
          <button onClick={addDriver} disabled={drivers.length >= 3}
            style={{
              marginLeft: "auto",
              background: drivers.length >= 3 ? "#3a0010" : "linear-gradient(135deg, #ffd700, #c8a800)",
              border: "none", color: drivers.length >= 3 ? "#666" : "#0a0a14",
              padding: "5px 12px", borderRadius: 4,
              fontSize: 10, cursor: drivers.length >= 3 ? "not-allowed" : "pointer", letterSpacing: 1.5,
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
            }}>+ ADD DRIVER</button>
        </div>

        {drivers.length === 0 && (
          <div style={{ color: "#444", fontSize: 12, padding: "20px 0", textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2 }}>
            ADD 2-3 DRIVERS TO COMPARE SIMULATIONS
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(drivers.length, 1)}, 1fr)`, gap: 10 }}>
          {drivers.map((d, idx) => {
            const tc = getTeamColor(d.driver, selectedRace?.year, selectedRace?.round_number);
            return (
              <div key={idx} style={{
                background: "#13132a", border: `1px solid ${tc}44`, borderRadius: 6,
                padding: "10px 12px", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: tc }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <select value={d.driver} onChange={e => {
                    const newDriver = raceData.drivers?.find(rd => rd.driver === e.target.value);
                    updateDriver(idx, {
                      driver: e.target.value,
                      start_compound: newDriver?.start_compound || "MEDIUM",
                      pit_stops: (newDriver?.pit_stops || []).map(p => ({ lap: p.lap, compound: p.to })),
                    });
                  }} style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "#fff", fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
                  }}>
                    {raceData?.drivers?.map(rd => (
                      <option key={rd.driver} value={rd.driver} style={{ background: "#13132a" }}>
                        P{rd.finish_position} {rd.driver}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => removeDriver(idx)} style={{
                    background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 14, padding: 0,
                  }}>×</button>
                </div>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 4 }}>START</div>
                <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                  {["SOFT", "MEDIUM", "HARD"].map(c => (
                    <button key={c} onClick={() => updateDriver(idx, { start_compound: c })}
                      style={{
                        flex: 1, padding: "4px 0",
                        border: `1px solid ${d.start_compound === c ? COMPOUNDS[c].color : "#1e1e3a"}`,
                        background: d.start_compound === c ? `${COMPOUNDS[c].color}22` : "transparent",
                        borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#aaa",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      }}>{c[0]}</button>
                  ))}
                </div>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 4 }}>PIT STOPS ({d.pit_stops.length})</div>
                {d.pit_stops.map((p, pi) => (
                  <div key={pi} style={{ display: "flex", gap: 4, marginBottom: 3, alignItems: "center" }}>
                    <input type="number" value={p.lap} min={1} max={raceData?.total_laps || 70}
                      onChange={e => {
                        const next = [...d.pit_stops];
                        next[pi] = { ...next[pi], lap: parseInt(e.target.value) || 1 };
                        updateDriver(idx, { pit_stops: next });
                      }}
                      style={{ width: 50, background: "#0a0a1a", border: "1px solid #1e1e3a", color: "#fff", padding: "3px 6px", borderRadius: 3, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    />
                    <select value={p.compound} onChange={e => {
                      const next = [...d.pit_stops];
                      next[pi] = { ...next[pi], compound: e.target.value };
                      updateDriver(idx, { pit_stops: next });
                    }} style={{ flex: 1, background: "#0a0a1a", border: "1px solid #1e1e3a", color: COMPOUNDS[p.compound]?.color || "#fff", padding: "3px 6px", borderRadius: 3, fontSize: 11 }}>
                      <option value="SOFT">SOFT</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                    <button onClick={() => {
                      const next = d.pit_stops.filter((_, i) => i !== pi);
                      updateDriver(idx, { pit_stops: next });
                    }} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: 0 }}>×</button>
                  </div>
                ))}
                <button onClick={() => {
                  const lastLap = d.pit_stops.length > 0 ? d.pit_stops[d.pit_stops.length - 1].lap : 1;
                  updateDriver(idx, { pit_stops: [...d.pit_stops, { lap: Math.min(lastLap + 15, raceData?.total_laps - 5 || 50), compound: "HARD" }] });
                }} style={{
                  width: "100%", marginTop: 4, padding: "4px 0",
                  background: "transparent", border: "1px dashed #2a2a4a",
                  color: "#666", borderRadius: 4, cursor: "pointer", fontSize: 10,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1,
                }}>+ ADD PIT</button>
              </div>
            );
          })}
        </div>

        {drivers.length >= 2 && (
          <button onClick={runAll} disabled={loading}
            style={{
              width: "100%", marginTop: 14, padding: "12px",
              background: "linear-gradient(135deg, #ffd700, #c8a800)",
              border: "none", color: "#0a0a14", cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
              fontSize: 14, letterSpacing: 2.5, borderRadius: 6,
              boxShadow: "0 0 16px rgba(255, 215, 0, 0.3)",
            }}>{loading ? "RUNNING..." : "RUN ALL SIMULATIONS →"}</button>
        )}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>}

      {results?.results && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${results.results.length}, 1fr)`, gap: 14 }}>
          {results.results.map((r, i) => {
            const tc = getTeamColor(r.driver, selectedRace?.year, selectedRace?.round_number);
            const isFaster = r.total_delta_seconds < 0;
            const gained = r.actual_position - r.simulated_position;
            return (
              <div key={i} style={{
                background: "#0f0f1e", border: `1px solid ${tc}44`,
                borderRadius: 10, padding: "16px 20px", position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: tc, boxShadow: `0 0 12px ${tc}88` }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{getDriverFlag(r.driver)}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", letterSpacing: 0.5 }}>{r.driver}</span>
                </div>
                {r.error ? (
                  <div style={{ color: "#ff5555", fontSize: 12 }}>{r.error}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 4 }}>TIME DELTA</div>
                    <div className="mono" style={{
                      fontWeight: 700, fontSize: 30, lineHeight: 1,
                      color: isFaster ? "#00ff88" : r.total_delta_seconds > 0 ? "#ff5555" : "#aaa",
                      textShadow: isFaster ? "0 0 12px rgba(0,255,136,0.4)" : r.total_delta_seconds > 0 ? "0 0 12px rgba(255,85,85,0.4)" : "none",
                    }}>{r.total_delta_seconds > 0 ? "+" : ""}{r.total_delta_seconds?.toFixed(1)}s</div>

                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginTop: 12, marginBottom: 4 }}>POSITION</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: "#666" }}>P{r.actual_position}</span>
                      <span style={{ color: gained > 0 ? "#00ff88" : gained < 0 ? "#ff5555" : "#444", fontSize: 14 }}>→</span>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28,
                        color: gained > 0 ? "#00ff88" : gained < 0 ? "#ff5555" : "#fff",
                      }}>P{r.simulated_position}</span>
                    </div>

                    <div style={{ fontSize: 10, letterSpacing: 1, color: "#666", marginTop: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                      {gained > 0 ? `Gained ${gained}` : gained < 0 ? `Lost ${-gained}` : "No change"}
                    </div>

                    <div style={{ fontSize: 10, color: "#666", marginTop: 12, fontFamily: "JetBrains Mono, monospace", paddingTop: 10, borderTop: "1px solid #1a1a30" }}>
                      {r.simulated_strategy}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Pit stop editor row
function PitStopEditor({ pitStop, index, totalLaps, onUpdate, onRemove, warning, safetyCarRanges, vscRanges }) {
  const inSC = (safetyCarRanges || []).some(r => pitStop.lap >= r.start && pitStop.lap <= r.end);
  const inVSC = (vscRanges || []).some(r => pitStop.lap >= r.start && pitStop.lap <= r.end);
  return (
    <div style={{
      background: "#13132a",
      border: warning?.severity === "extreme" ? "1px solid #ff4444" :
              warning?.severity === "stretched" ? "1px solid #ffaa00" :
              inSC ? "1px solid rgba(255, 200, 0, 0.55)" :
              inVSC ? "1px solid rgba(180, 140, 255, 0.5)" :
              "1px solid #1e1e3a",
      boxShadow: inSC ? "0 0 14px rgba(255, 200, 0, 0.15)" : inVSC ? "0 0 14px rgba(180, 140, 255, 0.12)" : "none",
      borderRadius: 7, padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{
          fontSize: 10, letterSpacing: 1.5, color: "#888",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        }}>PIT STOP #{index + 1}</span>
        <button onClick={onRemove} style={{
          background: "transparent", border: "none", color: "#666",
          cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Lap slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, fontWeight: 700 }}>PIT LAP</span>
          <span style={{ color: "#e8002d", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13 }}>LAP {pitStop.lap}</span>
        </div>
        <input type="range" min={2} max={totalLaps - 1} value={pitStop.lap}
          onChange={e => onUpdate({ ...pitStop, lap: parseInt(e.target.value) })}
          style={{ width: "100%", accentColor: "#e8002d", cursor: "pointer" }} />
      </div>

      {/* Compound */}
      <div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 5, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, fontWeight: 700 }}>
          NEW COMPOUND
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["SOFT", "MEDIUM", "HARD"].map(c => (
            <button key={c} onClick={() => onUpdate({ ...pitStop, compound: c })}
              style={{
                flex: 1, padding: "6px 4px",
                border: `2px solid ${pitStop.compound === c ? COMPOUNDS[c].color : "#1e1e3a"}`,
                background: pitStop.compound === c ? `${COMPOUNDS[c].color}22` : "#0f0f1e",
                borderRadius: 5, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
              <TireBadge compound={c} size={16} />
              <span style={{ fontSize: 10, color: pitStop.compound === c ? "#e8e8f0" : "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{c[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {warning && (
        <div style={{
          marginTop: 10, padding: "6px 8px", borderRadius: 5,
          background: warning.severity === "extreme" ? "#ff444422" : "#ffaa0022",
          fontSize: 11, color: warning.severity === "extreme" ? "#ff7777" : "#ffcc66",
        }}>
          ⚠️ {warning.message}
        </div>
      )}
      {inSC && (
        <div style={{
          marginTop: 10, padding: "6px 10px", borderRadius: 5,
          background: "rgba(255, 200, 0, 0.12)", border: "1px solid rgba(255, 200, 0, 0.4)",
          fontSize: 10, color: "#ffcc66",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1.2,
        }}>
          PITS UNDER SAFETY CAR · SAVES ~12s
        </div>
      )}
      {!inSC && inVSC && (
        <div style={{
          marginTop: 10, padding: "6px 10px", borderRadius: 5,
          background: "rgba(180, 140, 255, 0.10)", border: "1px solid rgba(180, 140, 255, 0.4)",
          fontSize: 10, color: "#c4a8ff",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1.2,
        }}>
          PITS UNDER VSC · SAVES ~8s
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("strategy");
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [raceData, setRaceData] = useState(null);
  const [raceLoading, setRaceLoading] = useState(false);

  // Simulator state
  const [simDriver, setSimDriver] = useState("VER");
  const [startCompound, setStartCompound] = useState("SOFT");
  const [pitStops, setPitStops] = useState([
    { lap: 20, compound: "MEDIUM" },
  ]);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // Chat
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Welcome to PitStrat AI 🏁\n\nI have data on 72 races from 2022–2025. Ask me anything about race strategy, tire degradation, or run a 'what if' simulation.\n\nTry: \"What if Verstappen pitted earlier in Bahrain 2023?\""
  }]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Model metrics
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Compare view
  const [compareMode, setCompareMode] = useState("battle"); // "battle" or "whatif"
  const [compareDriverA, setCompareDriverA] = useState("");
  const [compareDriverB, setCompareDriverB] = useState("");
  const [battleResult, setBattleResult] = useState(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/races`).then(r => r.json()).then(d => setRaces(d.races || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRace) { setRaceData(null); return; }
    setRaceLoading(true);
    setRaceData(null);
    setSimResult(null);
    fetch(`${API}/race/${selectedRace.year}/${selectedRace.round_number}`)
      .then(r => r.json())
      .then(d => {
        setRaceData(d);
        setRaceLoading(false);
        // Auto-load actual strategy of selected driver as default
        loadActualStrategy(d, simDriver);
      })
      .catch(() => setRaceLoading(false));
  }, [selectedRace]);

  // Reload defaults when driver changes
  useEffect(() => {
    if (raceData) loadActualStrategy(raceData, simDriver);
  }, [simDriver]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (view === "model" && !metrics && !metricsLoading) {
      setMetricsLoading(true);
      fetch(`${API}/model_metrics`)
        .then(r => r.json())
        .then(d => { setMetrics(d); setMetricsLoading(false); })
        .catch(() => setMetricsLoading(false));
    }
  }, [view, metrics, metricsLoading]);

  function loadActualStrategy(data, driver) {
    const d = data.drivers?.find(x => x.driver === driver);
    if (!d) return;
    setStartCompound(d.start_compound || "SOFT");
    if (d.pit_stops && d.pit_stops.length > 0) {
      setPitStops(d.pit_stops.map(p => ({ lap: p.lap, compound: p.to })));
    } else {
      setPitStops([{ lap: Math.floor(data.total_laps / 2), compound: "HARD" }]);
    }
    setSimResult(null);
  }

  function handleRaceChange(e) {
    const val = e.target.value;
    if (!val) { setSelectedRace(null); return; }
    const [y, r] = val.split("-");
    const race = races.find(x => x.year === parseInt(y) && x.round_number === parseInt(r));
    setSelectedRace(race || null);
  }

  function addPitStop() {
    if (!raceData) return;
    const lastLap = pitStops.length > 0 ? pitStops[pitStops.length - 1].lap : 0;
    const newLap = Math.min(lastLap + 20, raceData.total_laps - 5);
    setPitStops([...pitStops, { lap: newLap, compound: "HARD" }]);
    setSimResult(null);
  }

  function updatePitStop(idx, newPit) {
    const updated = [...pitStops];
    updated[idx] = newPit;
    setPitStops(updated);
    setSimResult(null);
  }

  function removePitStop(idx) {
    setPitStops(pitStops.filter((_, i) => i !== idx));
    setSimResult(null);
  }

  function resetToActual() {
    if (raceData) loadActualStrategy(raceData, simDriver);
  }

  async function runSimulation() {
    if (!selectedRace || pitStops.length === 0) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const r = await fetch(`${API}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedRace.year,
          round_number: selectedRace.round_number,
          driver: simDriver,
          start_compound: startCompound,
          pit_stops: pitStops,
        }),
      });
      setSimResult(await r.json());
    } catch (e) {
      setSimResult({ error: e.message });
    }
    setSimLoading(false);
  }

  async function sendChat() {
    if (!input.trim() || chatLoading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const r = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      const d = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: d.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Is the backend running?" }]);
    }
    setChatLoading(false);
  }

  async function runBattle() {
    if (!selectedRace || !compareDriverA || !compareDriverB) return;
    setBattleLoading(true);
    setBattleResult(null);
    try {
      const r = await fetch(`${API}/compare/${selectedRace.year}/${selectedRace.round_number}/${compareDriverA}/${compareDriverB}`);
      const d = await r.json();
      setBattleResult(d);
    } catch (err) {
      setBattleResult({ error: "Failed to load battle data" });
    }
    setBattleLoading(false);
  }

  function handleStintClick(driver) {
    setSimDriver(driver);
    setSimResult(null);
    setView("simulate");
  }

  const raceVal = selectedRace ? `${selectedRace.year}-${selectedRace.round_number}` : "";

  // Build warnings per stint based on tyre life
  const stintWarnings = pitStops.map((pit, idx) => {
    const prevLap = idx === 0 ? 1 : pitStops[idx - 1].lap;
    const compound = idx === 0 ? startCompound : pitStops[idx - 1].compound;
    const stintLength = pit.lap - prevLap;

    const ranges = { SOFT: [15, 25], MEDIUM: [25, 40], HARD: [40, 65] };
    const range = ranges[compound];
    if (!range) return null;
    if (stintLength > range[1] + 5) {
      return { severity: "extreme", message: `Stint of ${stintLength} laps on ${compound} is unrealistic (typical: ${range[0]}–${range[1]})` };
    }
    if (stintLength > range[1]) {
      return { severity: "stretched", message: `${compound} usually lasts ${range[0]}–${range[1]} laps, this is ${stintLength}` };
    }
    return null;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0a0a0f}
        ::-webkit-scrollbar-thumb{background:#e8002d44;border-radius:2px}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        select{appearance:none}
      `}</style>

      <header style={{
        borderBottom: "1px solid #16162a", background: "#0a0a0fcc",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 36 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e8002d", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: 2, color: "#fff" }}>
              PITSTRAT<span style={{ color: "#e8002d" }}> AI</span>
            </span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {[["strategy", "STRATEGY MAP"], ["simulate", "SIMULATE"], ["compare", "COMPARE"], ["chat", "PITSTRAT AI"], ["model", "MODEL"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: "5px 14px", border: "none", cursor: "pointer",
                background: view === id ? "#e8002d" : "transparent",
                color: view === id ? "#fff" : "#555",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 12, letterSpacing: 1.5,
                borderRadius: 4,
              }}>{label}</button>
            ))}
          </nav>
          <div style={{ marginLeft: "auto" }}>
            <RaceSelector races={races} value={raceVal} onChange={(v) => {
              handleRaceChange({ target: { value: v } });
            }} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
        {/* STRATEGY MAP — same as before */}
        {view === "strategy" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>STRATEGY MAP</h1>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Full race tire strategy — every driver, every stint. Click a row to simulate that driver.</p>

            {!selectedRace && (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#333", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 2 }}>SELECT A RACE FROM THE TOP RIGHT</div>
            )}
            {selectedRace && raceLoading && <div style={{ textAlign: "center", padding: "80px 0" }}><Spinner /></div>}

            {raceData && !raceLoading && (
              <>
                {/* HERO HEADER — F1 broadcast style */}
                <div style={{
                  background: "linear-gradient(135deg, #0a0a1a 0%, #13132a 100%)",
                  border: "1px solid #1e1e3a",
                  borderRadius: 12, marginBottom: 18,
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}>
                  {/* F1 car silhouette */}
                  <div style={{ position: "absolute", right: -120, top: -50, pointerEvents: "none" }}>
                    <F1CarSilhouette opacity={0.18} width={780} />
                  </div>

                  {/* Animated red corner accent */}
                  <div style={{
                    position: "absolute", top: 0, left: 0,
                    width: 4, height: "100%",
                    background: "linear-gradient(180deg, #e8002d, transparent)",
                    boxShadow: "0 0 12px rgba(232, 0, 45, 0.6)",
                  }} />

                  {/* Scan line effect */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(transparent 50%, rgba(232, 0, 45, 0.02) 50%)",
                    backgroundSize: "100% 4px",
                    pointerEvents: "none",
                  }} />

                  <div style={{ position: "relative", padding: "26px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 1 }}>
                    <div>
                      <div className="live-indicator" style={{
                        fontSize: 10, color: "#e8002d",
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800, letterSpacing: 3, marginBottom: 10,
                      }}>
                        RACE TELEMETRY · LIVE DATA FEED
                      </div>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800, fontSize: 44,
                        color: "#fff", letterSpacing: 0.5, lineHeight: 1,
                        textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                      }}>
                        {raceData.race}
                      </div>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800, fontSize: 70,
                        color: "#e8002d", letterSpacing: 2, lineHeight: 0.9,
                        textShadow: "0 0 32px rgba(232, 0, 45, 0.5)",
                        marginTop: -8,
                      }}>
                        {raceData.year}
                      </div>
                    </div>

                    {/* Stats panel */}
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
                      {[
                        { label: "LAPS", value: raceData.total_laps },
                        { label: "DRIVERS", value: raceData.drivers?.length },
                        { label: "ROUND", value: String(selectedRace?.round_number).padStart(2, "0") },
                        { label: "PIT STOPS", value: raceData.drivers?.reduce((sum, d) => sum + (d.pit_stops?.length || 0), 0) },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: 9, color: "#555",
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 700, letterSpacing: 2, marginBottom: 4,
                          }}>{s.label}</div>
                          <div className="mono" style={{
                            fontSize: 28, color: "#e8e8f0",
                            fontWeight: 700, lineHeight: 1,
                          }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom border with tire compounds */}
                  <div style={{
                    display: "flex", justifyContent: "flex-end",
                    gap: 22, padding: "12px 32px",
                    background: "rgba(5,5,13,0.4)",
                    borderTop: "1px solid #1a1a30",
                    position: "relative", zIndex: 1,
                  }}>
                    <span style={{
                      marginRight: "auto", fontSize: 10, color: "#444",
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      letterSpacing: 1.5,
                    }}>TYRE COMPOUNDS</span>
                    {["SOFT", "MEDIUM", "HARD"].map(c => (
                      <div key={c} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <TireBadge compound={c} size={20} />
                        <span style={{ fontSize: 11, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>{TYRE_LIFE[c]}</span>
                      </div>
                    ))}
                    {raceData.safety_car_ranges?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 14, borderLeft: "1px solid #1a1a30", marginLeft: 4 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4,
                          background: "repeating-linear-gradient(45deg, rgba(255, 200, 0, 0.7) 0 4px, rgba(255, 200, 0, 0.3) 4px 8px)",
                          border: "1px solid rgba(255, 200, 0, 0.7)",
                        }} />
                        <span style={{ fontSize: 11, color: "#ffc800", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>
                          SC L{raceData.safety_car_ranges.map(r => r.start === r.end ? r.start : `${r.start}-${r.end}`).join(", ")}
                        </span>
                      </div>
                    )}
                    {raceData.vsc_ranges?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4,
                          background: "repeating-linear-gradient(45deg, rgba(180, 140, 255, 0.6) 0 4px, rgba(180, 140, 255, 0.25) 4px 8px)",
                          border: "1px solid rgba(180, 140, 255, 0.6)",
                        }} />
                        <span style={{ fontSize: 11, color: "#b48cff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>
                          VSC L{raceData.vsc_ranges.map(r => r.start === r.end ? r.start : `${r.start}-${r.end}`).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 12px 12px", position: "relative", overflow: "hidden" }}>
                  {/* Column headers */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0 14px 12px 18px", borderBottom: "1px solid #1a1a30", marginBottom: 10,
                    fontSize: 9, letterSpacing: 1.5, color: "#444",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  }}>
                    <span style={{ width: 4 }}></span>
                    <span style={{ width: 38, textAlign: "center" }}>POS</span>
                    <span style={{ width: 18 }}></span>
                    <span style={{ width: 50 }}>DRIVER</span>
                    <span style={{ width: 110 }}>TEAM</span>
                    <span style={{ flex: 1 }}>TYRE STINTS · LAP <span style={{ color: "#e8002d" }}>0</span> → <span style={{ color: "#e8002d" }}>{raceData.total_laps}</span></span>
                    <span style={{ width: 42, textAlign: "center" }}>PITS</span>
                  </div>

                  {raceData.drivers?.map((d, idx) => (
                    <DriverRow key={d.driver} driver={d.driver}
                      finish_position={d.finish_position} stints={d.stints || []}
                      totalLaps={raceData.total_laps} onSelect={handleStintClick} index={idx}
                      safetyCarRanges={raceData.safety_car_ranges}
                      vscRanges={raceData.vsc_ranges}
                      year={raceData.year}
                      round={raceData.round_number} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SIMULATE — NEW multi-pit editor */}
        {view === "simulate" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            {/* HERO HEADER */}
            <div style={{
              background: "linear-gradient(135deg, #0a0a1a 0%, #13132a 100%)",
              border: "1px solid #1e1e3a",
              borderRadius: 12, marginBottom: 22,
              position: "relative", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ position: "absolute", right: -80, top: -30, pointerEvents: "none", transform: "scaleX(-1)" }}>
                <F1CarSilhouette opacity={0.14} width={620} />
              </div>
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: 4, height: "100%",
                background: "linear-gradient(180deg, #e8002d, transparent)",
                boxShadow: "0 0 12px rgba(232, 0, 45, 0.6)",
              }} />
              <div style={{ position: "relative", padding: "22px 28px", zIndex: 1 }}>
                <div className="live-indicator" style={{
                  fontSize: 10, color: "#e8002d",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, letterSpacing: 3, marginBottom: 8,
                }}>
                  STRATEGY SIMULATOR · COUNTERFACTUAL ENGINE
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: 38,
                  color: "#fff", letterSpacing: 0.5, lineHeight: 1,
                }}>
                  PITSTRAT <span style={{ color: "#e8002d" }}>EDITOR</span>
                </div>
                <div style={{ color: "#666", fontSize: 12, marginTop: 8, letterSpacing: 0.5, maxWidth: 600 }}>
                  Edit any pit stop · Add or remove stops · See full race impact with ML-predicted lap times and position changes
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18 }}>
              {/* CONTROLS */}
              <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: "#666" }}>
                    SIMULATION PARAMETERS
                  </span>
                  <button onClick={resetToActual} disabled={!raceData} style={{
                    background: "transparent", border: "1px solid #2a2a4a",
                    color: "#888", padding: "3px 8px", borderRadius: 4,
                    fontSize: 10, cursor: "pointer", letterSpacing: 1,
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  }}>RESET TO ACTUAL</button>
                </div>

                {/* Race */}
                <div style={{ marginBottom: 14, padding: "8px 12px", background: "#13132a", borderRadius: 6, border: "1px solid #1e1e3a" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 3 }}>RACE</div>
                  <div style={{ fontSize: 13, color: selectedRace ? "#e8e8f0" : "#e8002d" }}>
                    {selectedRace ? `${selectedRace.race_name} ${selectedRace.year}` : "← Select a race"}
                  </div>
                </div>

                {/* Driver — with team color preview */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>DRIVER</label>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                      background: getTeamColor(simDriver, raceData?.year, raceData?.round_number),
                      borderRadius: "4px 0 0 4px",
                      boxShadow: `0 0 8px ${getTeamColor(simDriver, raceData?.year, raceData?.round_number)}88`,
                    }} />
                    <select value={simDriver} onChange={e => setSimDriver(e.target.value)}
                      style={{
                        width: "100%", background: "#13132a", border: "1px solid #1e1e3a",
                        color: "#e8e8f0", padding: "10px 10px 10px 14px", borderRadius: 6,
                        fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                        appearance: "none", cursor: "pointer",
                      }}>
                      {raceData?.drivers?.map(d => (
                        <option key={d.driver} value={d.driver}>
                          {getDriverFlag(d.driver)} P{d.finish_position} {d.driver} · {getTeamName(d.driver, raceData?.year, raceData?.round_number)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Start compound */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>STARTING TYRE</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["SOFT", "MEDIUM", "HARD"].map(c => (
                      <button key={c} onClick={() => { setStartCompound(c); setSimResult(null); }}
                        style={{
                          flex: 1, padding: "6px 4px",
                          border: `2px solid ${startCompound === c ? COMPOUNDS[c].color : "#1e1e3a"}`,
                          background: startCompound === c ? `${COMPOUNDS[c].color}22` : "#13132a",
                          borderRadius: 5, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}>
                        <TireBadge compound={c} size={16} />
                        <span style={{ fontSize: 10, color: startCompound === c ? "#e8e8f0" : "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{c[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pit stops list */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                      PIT STOPS ({pitStops.length})
                    </label>
                    {pitStops.length < 3 && raceData && (
                      <button onClick={addPitStop} style={{
                        background: "#e8002d22", border: "1px solid #e8002d44", color: "#e8002d",
                        padding: "3px 10px", borderRadius: 4, fontSize: 11,
                        cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700, letterSpacing: 1,
                      }}>+ ADD STOP</button>
                    )}
                  </div>

                  {pitStops.map((p, i) => (
                    <PitStopEditor key={i} pitStop={p} index={i}
                      totalLaps={raceData?.total_laps || 70}
                      onUpdate={(np) => updatePitStop(i, np)}
                      onRemove={() => removePitStop(i)}
                      warning={stintWarnings[i]}
                      safetyCarRanges={raceData?.safety_car_ranges}
                      vscRanges={raceData?.vsc_ranges}
                    />
                  ))}

                  {pitStops.length === 0 && (
                    <div style={{ fontSize: 12, color: "#666", textAlign: "center", padding: 16, background: "#13132a", borderRadius: 6 }}>
                      No pit stops — full race on one set
                    </div>
                  )}
                </div>

                <button onClick={runSimulation} disabled={!selectedRace || simLoading}
                  style={{
                    width: "100%", padding: "11px",
                    background: !selectedRace ? "#1a1020" : "#e8002d",
                    border: "none", borderRadius: 7,
                    color: !selectedRace ? "#444" : "#fff",
                    cursor: !selectedRace ? "not-allowed" : "pointer",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, fontSize: 14, letterSpacing: 2,
                  }}>
                  {simLoading ? "SIMULATING..." : "RUN SIMULATION"}
                </button>
              </div>

              {/* RESULTS */}
              <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: 22, minHeight: 400 }}>
                {!simResult && !simLoading && (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "#2a2a4a" }}>
                    <div style={{ fontSize: 52 }}>🏎</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: 2 }}>EDIT THE STRATEGY AND RUN SIMULATION</div>
                  </div>
                )}
                {simLoading && (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>
                )}
                {simResult && !simResult.error && (
                  <div style={{ animation: "slideIn 0.25s ease" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      marginBottom: 18,
                    }}>
                      <div className="live-indicator" style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800, fontSize: 11, letterSpacing: 2.5, color: "#e8002d",
                      }}>SIMULATION RESULT</div>
                      <div style={{
                        flex: 1, height: 1, background: "linear-gradient(90deg, #e8002d44, transparent)",
                      }} />
                      <div style={{
                        fontSize: 11, color: "#666",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1.5,
                      }}>
                        {getDriverFlag(simResult.driver)} {simResult.driver} · {simResult.race} {simResult.year}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                      <div style={{
                        background: simResult.total_delta_seconds < 0
                          ? "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,255,136,0.02))"
                          : simResult.total_delta_seconds > 0
                          ? "linear-gradient(135deg, rgba(255,34,0,0.08), rgba(255,34,0,0.02))"
                          : "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                        border: `1px solid ${simResult.total_delta_seconds < 0 ? "#00ff8844" : simResult.total_delta_seconds > 0 ? "#ff220044" : "#ffffff15"}`,
                        borderRadius: 10, padding: "20px 22px",
                        boxShadow: simResult.total_delta_seconds < 0 ? "0 0 24px rgba(0,255,136,0.1)" : simResult.total_delta_seconds > 0 ? "0 0 24px rgba(255,34,0,0.1)" : "none",
                        position: "relative", overflow: "hidden",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 8 }}>TIME DELTA</div>
                        <div className="mono" style={{
                          fontWeight: 700, fontSize: 52, lineHeight: 1,
                          color: simResult.total_delta_seconds < 0 ? "#00ff88" : simResult.total_delta_seconds > 0 ? "#ff5555" : "#e8e8f0",
                          textShadow: simResult.total_delta_seconds < 0 ? "0 0 16px rgba(0,255,136,0.4)" : simResult.total_delta_seconds > 0 ? "0 0 16px rgba(255,85,85,0.4)" : "none",
                        }}>
                          {simResult.total_delta_seconds > 0 ? "+" : ""}{simResult.total_delta_seconds?.toFixed(1)}s
                        </div>
                        <div style={{
                          fontSize: 11, color: "#888", marginTop: 8,
                          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase",
                        }}>{simResult.direction}</div>
                      </div>

                      <div style={{
                        background: simResult.simulated_position < simResult.actual_position
                          ? "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,255,136,0.02))"
                          : simResult.simulated_position > simResult.actual_position
                          ? "linear-gradient(135deg, rgba(255,34,0,0.08), rgba(255,34,0,0.02))"
                          : "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                        border: `1px solid ${simResult.simulated_position < simResult.actual_position ? "#00ff8844" : simResult.simulated_position > simResult.actual_position ? "#ff220044" : "#ffffff15"}`,
                        borderRadius: 10, padding: "20px 22px",
                        boxShadow: simResult.simulated_position < simResult.actual_position ? "0 0 24px rgba(0,255,136,0.1)" : simResult.simulated_position > simResult.actual_position ? "0 0 24px rgba(255,34,0,0.1)" : "none",
                        position: "relative", overflow: "hidden",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 8 }}>POSITION</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                          <div style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 800, fontSize: 40, color: "#555", lineHeight: 1,
                          }}>P{simResult.actual_position}</div>
                          <div style={{
                            color: simResult.simulated_position < simResult.actual_position ? "#00ff88" : simResult.simulated_position > simResult.actual_position ? "#ff5555" : "#444",
                            fontSize: 24, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                          }}>→</div>
                          <div style={{
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 52, lineHeight: 1,
                            color: simResult.simulated_position < simResult.actual_position ? "#00ff88" : simResult.simulated_position > simResult.actual_position ? "#ff5555" : "#e8e8f0",
                            textShadow: simResult.simulated_position === 1 ? "0 0 16px rgba(255,215,0,0.4)" : "none",
                          }}>P{simResult.simulated_position}</div>
                        </div>
                        <div style={{
                          fontSize: 11, color: "#888", marginTop: 8,
                          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase",
                        }}>
                          {simResult.simulated_position < simResult.actual_position
                            ? `Gained ${simResult.actual_position - simResult.simulated_position} position${simResult.actual_position - simResult.simulated_position > 1 ? "s" : ""}`
                            : simResult.simulated_position > simResult.actual_position
                            ? `Lost ${simResult.simulated_position - simResult.actual_position} position${simResult.simulated_position - simResult.actual_position > 1 ? "s" : ""}`
                            : "No change"}
                        </div>
                      </div>
                    </div>

                    {simResult.position_change && (
                      <div style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#aaa" }}>
                        {simResult.position_change}
                      </div>
                    )}

                    {/* Tyre warnings from backend */}
                    {simResult.tyre_warnings?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        {simResult.tyre_warnings.map((w, i) => (
                          <div key={i} style={{
                            padding: "8px 12px", borderRadius: 6, marginBottom: 4,
                            background: w.severity === "extreme" ? "#ff444422" : "#ffaa0022",
                            border: `1px solid ${w.severity === "extreme" ? "#ff444444" : "#ffaa0044"}`,
                            fontSize: 12, color: w.severity === "extreme" ? "#ff7777" : "#ffcc66",
                          }}>
                            ⚠️ Stint {w.stint}: {w.message}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "ACTUAL STRATEGY", value: simResult.actual_strategy, color: "#444" },
                        { label: "SIMULATED STRATEGY", value: simResult.simulated_strategy, color: "#e8002d" },
                      ].map(s => (
                        <div key={s.label} style={{ background: "#13132a", borderRadius: 7, padding: "12px 14px", border: `1px solid ${s.color}22` }}>
                          <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: s.color, marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8f0" }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 7, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                      {simResult.summary}
                    </div>

                    {/* Top 6 Standings — Gap to leader + Interval to car ahead */}
                    {simResult.standings?.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#444", marginBottom: 8 }}>SIMULATED TOP 6</div>
                        <div style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 7, padding: "8px 4px", marginBottom: 14 }}>
                          {/* Header row */}
                          <div style={{
                            display: "flex", alignItems: "center", padding: "4px 12px", gap: 12,
                            fontSize: 9, letterSpacing: 1.5, color: "#333",
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                            borderBottom: "1px solid #1e1e3a", marginBottom: 4,
                          }}>
                            <span style={{ width: 28, textAlign: "center" }}>POS</span>
                            <span style={{ width: 50 }}>DRIVER</span>
                            <span style={{ flex: 1, textAlign: "right" }}>GAP</span>
                            <span style={{ width: 70, textAlign: "right" }}>INTERVAL</span>
                          </div>

                          {simResult.standings.slice(0, 6).map((s, idx, arr) => {
                            const carAhead = idx > 0 ? arr[idx - 1] : null;
                            const interval = carAhead ? s.total_time - carAhead.total_time : 0;
                            return (
                              <div key={s.driver} style={{
                                display: "flex", alignItems: "center", padding: "6px 12px", gap: 12,
                                background: s.is_simulated ? "#e8002d22" : "transparent",
                                borderRadius: 4,
                              }}>
                                <span style={{
                                  width: 28, textAlign: "center",
                                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                                  color: s.position === 1 ? "#ffd700" : s.position <= 3 ? "#aaa" : "#555",
                                }}>P{s.position}</span>
                                <span style={{
                                  width: 50, fontFamily: "'Barlow Condensed', sans-serif",
                                  fontWeight: 700, fontSize: 14,
                                  color: s.is_simulated ? "#e8002d" : "#e8e8f0", letterSpacing: 0.5,
                                }}>{s.driver}</span>
                                <span style={{ flex: 1, fontSize: 12, color: "#666", textAlign: "right" }}>
                                  {s.position === 1 ? "LEADER" : `+${s.gap_to_leader.toFixed(2)}s`}
                                </span>
                                <span style={{ width: 70, fontSize: 12, color: "#888", textAlign: "right", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>
                                  {s.position === 1 ? "—" : `+${interval.toFixed(2)}s`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {simResult.key_laps?.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#444", marginBottom: 8 }}>KEY LAP DIFFERENCES</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {simResult.key_laps.map((l, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#13132a", borderRadius: 5, padding: "7px 12px" }}>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: "#555", width: 46 }}>LAP {l.lap}</span>
                              <div style={{ flex: 1, display: "flex", gap: 8, fontSize: 12 }}>
                                <span style={{ color: "#444" }}>{l.actual?.toFixed(3) || "—"}s</span>
                                <span style={{ color: "#2a2a4a" }}>→</span>
                                <span style={{ color: "#888" }}>{l.simulated?.toFixed(3)}s</span>
                              </div>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: l.delta < 0 ? "#00ff88" : "#ff5555" }}>
                                {l.delta > 0 ? "+" : ""}{l.delta?.toFixed(2)}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {simResult?.error && (
                  <div style={{ color: "#ff5555", padding: 16, fontSize: 14 }}>Error: {simResult.error}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHAT — same as before */}
        {view === "compare" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            {/* HERO HEADER */}
            <div style={{
              background: "linear-gradient(135deg, #0a0a1a 0%, #13132a 100%)",
              border: "1px solid #1e1e3a",
              borderRadius: 12, marginBottom: 22,
              position: "relative", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ position: "absolute", right: -80, top: -30, pointerEvents: "none", transform: "scaleX(-1)" }}>
                <F1CarSilhouette opacity={0.10} width={580} />
              </div>
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: 4, height: "100%",
                background: "linear-gradient(180deg, #ffd700, transparent)",
                boxShadow: "0 0 12px rgba(255, 215, 0, 0.4)",
              }} />
              <div style={{ position: "relative", padding: "22px 28px", zIndex: 1 }}>
                <div className="live-indicator" style={{
                  fontSize: 10, color: "#ffd700",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, letterSpacing: 3, marginBottom: 8,
                }}>
                  HEAD TO HEAD · STRATEGY COMPARISON
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: 38,
                  color: "#fff", letterSpacing: 0.5, lineHeight: 1,
                }}>
                  STRATEGY <span style={{ color: "#ffd700" }}>BATTLE</span>
                </div>
                <div style={{ color: "#666", fontSize: 12, marginTop: 8, letterSpacing: 0.5, maxWidth: 600 }}>
                  Compare two drivers in the same race · See where the race was won and lost lap by lap
                </div>
              </div>
            </div>

            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["battle", "ACTUAL RACE"], ["whatif", "WHAT-IF SIM"]].map(([id, label]) => (
                <button key={id} onClick={() => setCompareMode(id)} style={{
                  padding: "8px 18px",
                  background: compareMode === id ? "linear-gradient(135deg, #ffd700, #c8a800)" : "#0f0f1e",
                  border: `1px solid ${compareMode === id ? "#ffd700" : "#1e1e3a"}`,
                  color: compareMode === id ? "#0a0a14" : "#888",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                  fontSize: 12, letterSpacing: 2, borderRadius: 6, cursor: "pointer",
                  boxShadow: compareMode === id ? "0 0 12px rgba(255, 215, 0, 0.3)" : "none",
                }}>{label}</button>
              ))}
            </div>

            {compareMode === "battle" && (
              <>
                {/* Controls */}
                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "16px 20px", marginBottom: 18, display: "flex", alignItems: "flex-end", gap: 14 }}>
                  {!selectedRace && (
                    <div style={{ color: "#e8002d", fontSize: 13, padding: "10px 0" }}>← Pick a race from the dropdown above</div>
                  )}
                  {selectedRace && (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>DRIVER A</div>
                        <div style={{ position: "relative" }}>
                          {compareDriverA && (
                            <div style={{
                              position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                              background: getTeamColor(compareDriverA, raceData?.year, raceData?.round_number),
                              borderRadius: "4px 0 0 4px",
                              boxShadow: `0 0 8px ${getTeamColor(compareDriverA, raceData?.year, raceData?.round_number)}88`,
                            }} />
                          )}
                          <select value={compareDriverA} onChange={e => { setCompareDriverA(e.target.value); setBattleResult(null); }}
                            style={{
                              width: "100%", background: "#13132a", border: "1px solid #1e1e3a",
                              color: "#e8e8f0", padding: "10px 10px 10px 14px", borderRadius: 6,
                              fontSize: 13, appearance: "none", cursor: "pointer",
                            }}>
                            <option value="">Select driver...</option>
                            {raceData?.drivers?.map(d => (
                              <option key={d.driver} value={d.driver}>
                                {getDriverFlag(d.driver)} P{d.finish_position} {d.driver} · {getTeamName(d.driver, raceData?.year, raceData?.round_number)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22,
                        color: "#ffd700", padding: "0 4px 10px", letterSpacing: 1,
                      }}>VS</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>DRIVER B</div>
                        <div style={{ position: "relative" }}>
                          {compareDriverB && (
                            <div style={{
                              position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                              background: getTeamColor(compareDriverB, raceData?.year, raceData?.round_number),
                              borderRadius: "4px 0 0 4px",
                              boxShadow: `0 0 8px ${getTeamColor(compareDriverB, raceData?.year, raceData?.round_number)}88`,
                            }} />
                          )}
                          <select value={compareDriverB} onChange={e => { setCompareDriverB(e.target.value); setBattleResult(null); }}
                            style={{
                              width: "100%", background: "#13132a", border: "1px solid #1e1e3a",
                              color: "#e8e8f0", padding: "10px 10px 10px 14px", borderRadius: 6,
                              fontSize: 13, appearance: "none", cursor: "pointer",
                            }}>
                            <option value="">Select driver...</option>
                            {raceData?.drivers?.map(d => (
                              <option key={d.driver} value={d.driver}>
                                {getDriverFlag(d.driver)} P{d.finish_position} {d.driver} · {getTeamName(d.driver, raceData?.year, raceData?.round_number)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button onClick={runBattle} disabled={!compareDriverA || !compareDriverB || battleLoading}
                        style={{
                          padding: "10px 22px",
                          background: !compareDriverA || !compareDriverB ? "#3a0010" : "linear-gradient(135deg, #ffd700, #c8a800)",
                          color: !compareDriverA || !compareDriverB ? "#666" : "#0a0a14",
                          border: "none", borderRadius: 6, cursor: !compareDriverA || !compareDriverB ? "not-allowed" : "pointer",
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                          fontSize: 13, letterSpacing: 2,
                          boxShadow: !compareDriverA || !compareDriverB ? "none" : "0 0 16px rgba(255, 215, 0, 0.3)",
                        }}>{battleLoading ? "..." : "COMPARE →"}</button>
                    </>
                  )}
                </div>

                {battleLoading && <div style={{ textAlign: "center", padding: 60 }}><Spinner /></div>}

                {battleResult && !battleResult.error && (
                  <BattleResults result={battleResult} />
                )}

                {battleResult?.error && (
                  <div style={{ background: "#e8002d11", border: "1px solid #e8002d44", borderRadius: 8, padding: "14px 18px", color: "#ff5555" }}>
                    {battleResult.error}
                  </div>
                )}

                {!battleResult && !battleLoading && selectedRace && (
                  <div style={{ textAlign: "center", padding: 80, color: "#444", border: "1px dashed #1e1e3a", borderRadius: 10 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 2, color: "#555" }}>SELECT TWO DRIVERS AND HIT COMPARE</div>
                  </div>
                )}
              </>
            )}

            {compareMode === "whatif" && (
              <WhatIfCompare raceData={raceData} selectedRace={selectedRace} />
            )}
          </div>
        )}

        {view === "chat" && (
          <div style={{ animation: "slideIn 0.25s ease", height: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
            {/* HERO HEADER */}
            <div style={{
              background: "linear-gradient(135deg, #0a0a1a 0%, #13132a 100%)",
              border: "1px solid #1e1e3a",
              borderRadius: 12, marginBottom: 18,
              position: "relative", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ position: "absolute", right: -60, top: -40, pointerEvents: "none" }}>
                <F1CarSilhouette opacity={0.12} width={560} />
              </div>
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: 4, height: "100%",
                background: "linear-gradient(180deg, #e8002d, transparent)",
                boxShadow: "0 0 12px rgba(232, 0, 45, 0.6)",
              }} />
              <div style={{ position: "relative", padding: "22px 28px", zIndex: 1 }}>
                <div className="live-indicator" style={{
                  fontSize: 10, color: "#e8002d",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, letterSpacing: 3, marginBottom: 8,
                }}>
                  RACE ENGINEER · POWERED BY IBM GRANITE
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: 38,
                  color: "#fff", letterSpacing: 0.5, lineHeight: 1,
                }}>
                  PITSTRAT <span style={{ color: "#e8002d" }}>AI</span>
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 11, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1.5 }}>
                  <span><span className="mono" style={{ color: "#e8e8f0" }}>72</span> RACES</span>
                  <span><span className="mono" style={{ color: "#e8e8f0" }}>4</span> SEASONS · 2022–2025</span>
                  <span><span className="mono" style={{ color: "#e8e8f0" }}>5</span> MCP TOOLS</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 10, letterSpacing: 2, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 8 }}>SUGGESTED QUERIES</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                "What if Verstappen pitted lap 20 on hards in Bahrain 2023?",
                "How fast do soft tyres degrade at Monaco?",
                "Who pitted first in Bahrain 2024?",
                "Compare VER vs NOR strategy in Bahrain 2024",
              ].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{
                  background: "#0f0f1e", border: "1px solid #1e1e3a",
                  color: "#888", padding: "6px 13px", borderRadius: 20,
                  fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "#e8002d44";
                  e.currentTarget.style.color = "#e8e8f0";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#1e1e3a";
                  e.currentTarget.style.color = "#888";
                }}
                >{q}</button>
              ))}
            </div>

            <div style={{
              flex: 1, overflowY: "auto",
              background: "#05050d",
              border: "1px solid #16162a",
              borderRadius: 10,
              padding: "18px 16px",
              marginBottom: 12,
              position: "relative",
            }}>
              {/* Scan line at top */}
              <div style={{
                position: "sticky", top: -18,
                marginTop: -18, marginLeft: -16, marginRight: -16,
                height: 24,
                background: "linear-gradient(180deg, #05050d 60%, transparent)",
                zIndex: 5, pointerEvents: "none",
              }} />

              {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, #e8002d, #8a001a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                    fontSize: 11, color: "#fff", flexShrink: 0,
                    boxShadow: "0 0 12px rgba(232, 0, 45, 0.4)",
                    animation: "pulseRed 1.5s infinite",
                  }}>PW</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 10, color: "#e8002d", letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>ANALYSING</div>
                    <Spinner />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8, position: "relative" }}>
              <div style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 10, color: "#e8002d", fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800, letterSpacing: 2, pointerEvents: "none",
              }}>{">"}</div>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about race strategy, tire degradation, or run a what-if simulation..."
                style={{
                  flex: 1, background: "#0f0f1e", border: "1px solid #1e1e3a",
                  borderRadius: 9, color: "#e8e8f0", padding: "12px 15px 12px 32px",
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{
                padding: "12px 22px",
                background: chatLoading || !input.trim() ? "#3a0010" : "linear-gradient(135deg, #e8002d, #b3001f)",
                border: "none", borderRadius: 9,
                color: "#fff", cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 2,
                opacity: chatLoading || !input.trim() ? 0.5 : 1,
                boxShadow: chatLoading || !input.trim() ? "none" : "0 0 16px rgba(232, 0, 45, 0.3)",
                transition: "all 0.15s",
              }}>SEND →</button>
            </div>
          </div>
        )}

        {/* MODEL EVALUATION VIEW */}
        {view === "model" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            {/* HERO HEADER */}
            <div style={{
              background: "linear-gradient(135deg, #0a0a1a 0%, #13132a 100%)",
              border: "1px solid #1e1e3a",
              borderRadius: 12, marginBottom: 22,
              position: "relative", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ position: "absolute", right: -90, top: -30, pointerEvents: "none" }}>
                <F1CarSilhouette opacity={0.10} width={600} />
              </div>
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: 4, height: "100%",
                background: "linear-gradient(180deg, #00d4ff, transparent)",
                boxShadow: "0 0 12px rgba(0, 212, 255, 0.4)",
              }} />
              <div style={{ position: "relative", padding: "22px 28px", zIndex: 1 }}>
                <div className="live-indicator" style={{
                  fontSize: 10, color: "#00d4ff",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, letterSpacing: 3, marginBottom: 8,
                }}>
                  ML ENGINE · DEGRADATION MODEL
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800, fontSize: 38,
                  color: "#fff", letterSpacing: 0.5, lineHeight: 1,
                }}>
                  MODEL <span style={{ color: "#00d4ff" }}>TELEMETRY</span>
                </div>
                <div style={{ color: "#666", fontSize: 12, marginTop: 8, letterSpacing: 0.5, maxWidth: 600 }}>
                  XGBoost regressor trained on 71,999 lap records from 72 races · validation metrics, feature importance, prediction accuracy
                </div>
              </div>
            </div>

            {metricsLoading && <div style={{ textAlign: "center", padding: "80px 0" }}><Spinner /></div>}

            {metrics && !metricsLoading && (
              <>
                {/* Top metric cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                  {[
                    { label: "MAE", value: `${metrics.validation_metrics.mae}s`, subtitle: "Mean Absolute Error", color: "#00ff88" },
                    { label: "RMSE", value: `${metrics.validation_metrics.rmse}s`, subtitle: "Root Mean Squared Error", color: "#ffd700" },
                    { label: "R²", value: metrics.validation_metrics.r2.toFixed(4), subtitle: `${(metrics.validation_metrics.r2 * 100).toFixed(1)}% variance explained`, color: "#00d4ff" },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: `linear-gradient(135deg, ${m.color}10, ${m.color}03)`,
                      border: `1px solid ${m.color}33`, borderRadius: 10,
                      padding: "22px 24px",
                      position: "relative", overflow: "hidden",
                      boxShadow: `0 0 24px ${m.color}11`,
                    }}>
                      <div style={{
                        position: "absolute", top: 0, left: 0,
                        width: 3, height: "100%",
                        background: `linear-gradient(180deg, ${m.color}, transparent)`,
                      }} />
                      <div style={{ fontSize: 10, letterSpacing: 2.5, color: m.color, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, marginBottom: 10, opacity: 0.8 }}>{m.label}</div>
                      <div className="mono" style={{
                        fontWeight: 700, fontSize: 46, color: m.color, lineHeight: 1,
                        textShadow: `0 0 16px ${m.color}66`,
                      }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, fontWeight: 700, textTransform: "uppercase" }}>{m.subtitle}</div>
                    </div>
                  ))}
                </div>

                {/* Training info */}
                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "16px 22px", marginBottom: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 10 }}>TRAINING CONFIGURATION</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, fontSize: 13 }}>
                    {[
                      ["Model", metrics.model_type],
                      ["Total samples", metrics.training.total_samples.toLocaleString()],
                      ["Train / Val split", `${metrics.training.train_samples.toLocaleString()} / ${metrics.training.val_samples.toLocaleString()}`],
                      ["Estimators", `${metrics.n_estimators}, depth ${metrics.max_depth}, lr ${metrics.learning_rate}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 3 }}>{k.toUpperCase()}</div>
                        <div style={{ color: "#ccc" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
                  {/* Feature importance */}
                  <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 16 }}>FEATURE IMPORTANCE</div>
                    {metrics.feature_importance.map(f => (
                      <div key={f.feature} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>{f.feature}</span>
                          <span style={{ fontSize: 11, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{(f.importance * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 6, background: "#13132a", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${f.importance * 100}%`, height: "100%",
                            background: "linear-gradient(90deg, #e8002d, #ff5566)",
                            borderRadius: 3,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-compound MAE */}
                  <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 16 }}>ACCURACY BY COMPOUND</div>
                    {metrics.by_compound.map(c => {
                      const colors = { SOFT: "#e8002d", MEDIUM: "#ffd700", HARD: "#ebebeb", INTERMEDIATE: "#39b54a", WET: "#0067ff" };
                      return (
                        <div key={c.compound} style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                          <TireBadge compound={c.compound} size={26} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 13, color: "#ccc", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{c.compound}</span>
                              <span style={{ fontSize: 13, color: c.mae < 2 ? "#00ff88" : c.mae < 3 ? "#ffd700" : "#ff5555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{c.mae.toFixed(2)}s MAE</span>
                            </div>
                            <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{c.samples.toLocaleString()} samples</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Predicted vs Actual scatter */}
                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 16 }}>PREDICTED vs ACTUAL — 500 RANDOM VALIDATION SAMPLES</div>
                  <ScatterPlot data={metrics.scatter_sample} />
                </div>

                {/* Residual histogram */}
                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "18px 22px" }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "#666", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 16 }}>RESIDUAL DISTRIBUTION (Predicted − Actual)</div>
                  <ResidualHistogram data={metrics.residual_histogram} />
                </div>
              </>
            )}

            {!metrics && !metricsLoading && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
                <p>Metrics not available. Run:</p>
                <code style={{ background: "#1a1a2e", padding: "8px 14px", borderRadius: 6, color: "#e8002d", marginTop: 10, display: "inline-block" }}>python -m backend.ml.evaluate</code>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}