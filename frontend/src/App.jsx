import { useState, useEffect, useRef } from "react";

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

function StintBar({ stint, totalLaps }) {
  const c = COMPOUNDS[stint.compound] || COMPOUNDS.UNKNOWN;
  const left = ((stint.lap_start - 1) / totalLaps) * 100;
  const width = (stint.total_laps / totalLaps) * 100;
  return (
    <div title={`${stint.compound} laps ${stint.laps} • deg ${stint.degradation_rate_per_lap?.toFixed(3) ?? "N/A"}s/lap`}
      style={{
        position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
        height: "100%", background: c.color,
        borderRadius: 3, borderRight: "2px solid #0a0a0f",
      }}
    />
  );
}

function DriverRow({ driver, finish_position, stints, totalLaps, onSelect }) {
  return (
    <div onClick={() => onSelect(driver)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 7, cursor: "pointer",
        padding: "3px 6px", borderRadius: 4,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{
        width: 28, textAlign: "right",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 12,
        color: finish_position === 1 ? "#ffd700" : finish_position <= 3 ? "#aaa" : "#444",
      }}>P{finish_position}</span>
      <span style={{
        width: 38, textAlign: "right",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 13,
        color: "#ccc", letterSpacing: 0.5,
      }}>{driver}</span>
      <div style={{ flex: 1, position: "relative", height: 18, background: "#111", borderRadius: 3 }}>
        {stints.map((s, i) => <StintBar key={i} stint={s} totalLaps={totalLaps} />)}
      </div>
      <span style={{
        width: 24, textAlign: "center", fontSize: 11, color: "#444",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>{stints.length - 1}P</span>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: "#e8002d",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          fontSize: 11, color: "#fff", marginRight: 8, flexShrink: 0, marginTop: 2,
        }}>PW</div>
      )}
      <div style={{
        maxWidth: "76%", padding: "10px 14px",
        background: isUser ? "#e8002d1a" : "#14142a",
        border: `1px solid ${isUser ? "#e8002d33" : "#252545"}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        color: "#e0e0f0", fontSize: 14, lineHeight: 1.65,
        whiteSpace: "pre-wrap",
      }}>{msg.content}</div>
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

// Pit stop editor row
function PitStopEditor({ pitStop, index, totalLaps, onUpdate, onRemove, warning }) {
  return (
    <div style={{
      background: "#13132a",
      border: warning?.severity === "extreme" ? "1px solid #ff4444" :
              warning?.severity === "stretched" ? "1px solid #ffaa00" : "1px solid #1e1e3a",
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
    content: "Welcome to PitWall AI 🏁\n\nI have data on 72 races from 2022–2025. Ask me anything about race strategy, tire degradation, or run a 'what if' simulation.\n\nTry: \"What if Verstappen pitted earlier in Bahrain 2023?\""
  }]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Model metrics
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
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
              PITWALL<span style={{ color: "#e8002d" }}> AI</span>
            </span>
          </div>
          <nav style={{ display: "flex", gap: 2 }}>
            {[["strategy", "STRATEGY MAP"], ["simulate", "SIMULATE"], ["chat", "PITWALL AI"], ["model", "MODEL"]].map(([id, label]) => (
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
            <select value={raceVal} onChange={handleRaceChange} style={{
              background: "#13132a", border: "1px solid #252545",
              color: raceVal ? "#e8e8f0" : "#555",
              padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", minWidth: 240,
            }}>
              <option value="">Select a race...</option>
              {races.map(r => (
                <option key={`${r.year}-${r.round_number}`} value={`${r.year}-${r.round_number}`}>
                  {r.year} R{String(r.round_number).padStart(2, "0")} — {r.race_name}
                </option>
              ))}
            </select>
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
                <div style={{
                  background: "#0f0f1e", border: "1px solid #16162a",
                  borderRadius: 10, padding: "16px 22px", marginBottom: 20,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff" }}>
                      {raceData.race} {raceData.year}
                    </div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>
                      {raceData.total_laps} laps · {raceData.drivers?.length} drivers
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {["SOFT", "MEDIUM", "HARD"].map(c => (
                      <div key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <TireBadge compound={c} size={20} />
                        <span style={{ fontSize: 11, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{TYRE_LIFE[c]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "16px 16px 10px" }}>
                  {raceData.drivers?.map(d => (
                    <DriverRow key={d.driver} driver={d.driver}
                      finish_position={d.finish_position} stints={d.stints || []}
                      totalLaps={raceData.total_laps} onSelect={handleStintClick} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SIMULATE — NEW multi-pit editor */}
        {view === "simulate" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>STRATEGY SIMULATOR</h1>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Edit any pit stop · Add or remove stops · See the full strategy impact</p>

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

                {/* Driver */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>DRIVER</label>
                  <select value={simDriver} onChange={e => setSimDriver(e.target.value)}
                    style={{ width: "100%", background: "#13132a", border: "1px solid #1e1e3a", color: "#e8e8f0", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}>
                    {raceData?.drivers?.map(d => (
                      <option key={d.driver} value={d.driver}>P{d.finish_position} {d.driver}</option>
                    ))}
                  </select>
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
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: "#444", marginBottom: 16 }}>
                      RESULTS — {simResult.driver} · {simResult.race} {simResult.year}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={{
                        background: simResult.total_delta_seconds < 0 ? "#00ff8810" : simResult.total_delta_seconds > 0 ? "#ff220010" : "#ffffff08",
                        border: `1px solid ${simResult.total_delta_seconds < 0 ? "#00ff8830" : simResult.total_delta_seconds > 0 ? "#ff220030" : "#ffffff15"}`,
                        borderRadius: 8, padding: "16px 18px",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 6 }}>TIME DELTA</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 40, color: simResult.total_delta_seconds < 0 ? "#00ff88" : simResult.total_delta_seconds > 0 ? "#ff5555" : "#e8e8f0" }}>
                          {simResult.total_delta_seconds > 0 ? "+" : ""}{simResult.total_delta_seconds?.toFixed(1)}s
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{simResult.direction}</div>
                      </div>

                      <div style={{
                        background: simResult.simulated_position < simResult.actual_position ? "#00ff8810" :
                                    simResult.simulated_position > simResult.actual_position ? "#ff220010" : "#ffffff08",
                        border: `1px solid ${simResult.simulated_position < simResult.actual_position ? "#00ff8830" :
                                             simResult.simulated_position > simResult.actual_position ? "#ff220030" : "#ffffff15"}`,
                        borderRadius: 8, padding: "16px 18px",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 6 }}>POSITION</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#666" }}>P{simResult.actual_position}</div>
                          <div style={{ color: "#333", fontSize: 20 }}>→</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32,
                            color: simResult.simulated_position < simResult.actual_position ? "#00ff88" :
                                   simResult.simulated_position > simResult.actual_position ? "#ff5555" : "#e8e8f0",
                          }}>P{simResult.simulated_position}</div>
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
        {view === "chat" && (
          <div style={{ animation: "slideIn 0.25s ease", height: "calc(100vh - 150px)", display: "flex", flexDirection: "column" }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>PITWALL AI</h1>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Powered by IBM Granite · 72 races · 2022–2025</p>

            <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                "What if Verstappen pitted lap 20 on hards in Bahrain 2023?",
                "How fast do soft tyres degrade at Monaco?",
                "Who pitted first in Bahrain 2024?",
                "Compare VER vs NOR strategy in Bahrain 2024",
              ].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{
                  background: "#0f0f1e", border: "1px solid #1e1e3a",
                  color: "#666", padding: "5px 11px", borderRadius: 20,
                  fontSize: 12, cursor: "pointer",
                }}>{q}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #16162a", borderBottom: "1px solid #16162a", padding: "14px 0", marginBottom: 12 }}>
              {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8002d", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: "#fff", flexShrink: 0 }}>PW</div>
                  <Spinner />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about race strategy, tire degradation, or run a what-if simulation..."
                style={{ flex: 1, background: "#0f0f1e", border: "1px solid #1e1e3a", borderRadius: 9, color: "#e8e8f0", padding: "11px 15px", fontSize: 14 }}
              />
              <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{
                padding: "11px 18px", background: "#e8002d", border: "none", borderRadius: 9,
                color: "#fff", cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
                opacity: chatLoading || !input.trim() ? 0.4 : 1,
              }}>SEND</button>
            </div>
          </div>
        )}

        {/* MODEL EVALUATION VIEW */}
        {view === "model" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>MODEL EVALUATION</h1>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>XGBoost tire degradation model · Trained on 72 races · 4 seasons</p>

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
                      background: "#0f0f1e", border: `1px solid ${m.color}33`, borderRadius: 10,
                      padding: "20px 22px",
                    }}>
                      <div style={{ fontSize: 10, letterSpacing: 2, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 8 }}>{m.label}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 38, color: m.color, lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>{m.subtitle}</div>
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