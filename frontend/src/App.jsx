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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      title={`${stint.compound} laps ${stint.laps} • deg ${stint.degradation_rate_per_lap?.toFixed(3) ?? "N/A"}s/lap`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
        height: "100%", background: c.color,
        borderRadius: 3, borderRight: "2px solid #0a0a0f",
        filter: hovered ? "brightness(1.4)" : "brightness(1)",
        transition: "filter 0.1s",
        cursor: "default",
      }}
    />
  );
}

function DriverRow({ driver, finish_position, stints, totalLaps, onSelect }) {
  return (
    <div
      onClick={() => onSelect(driver)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 7, cursor: "pointer",
        padding: "3px 6px", borderRadius: 4,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Position */}
      <span style={{
        width: 28, textAlign: "right",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 12,
        color: finish_position === 1 ? "#ffd700" : finish_position <= 3 ? "#aaa" : "#444",
      }}>P{finish_position}</span>

      {/* Driver code */}
      <span style={{
        width: 38, textAlign: "right",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 13,
        color: "#ccc", letterSpacing: 0.5,
      }}>{driver}</span>

      {/* Stint bars */}
      <div style={{
        flex: 1, position: "relative", height: 18,
        background: "#111", borderRadius: 3,
      }}>
        {stints.map((s, i) => (
          <StintBar key={i} stint={s} totalLaps={totalLaps} />
        ))}
      </div>

      {/* Pit count */}
      <span style={{
        width: 24, textAlign: "center",
        fontSize: 11, color: "#444",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>{stints.length - 1}P</span>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 14,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "#e8002d",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 11, color: "#fff",
          marginRight: 8, flexShrink: 0, marginTop: 2,
        }}>PW</div>
      )}
      <div style={{
        maxWidth: "76%", padding: "10px 14px",
        background: isUser ? "#e8002d1a" : "#14142a",
        border: `1px solid ${isUser ? "#e8002d33" : "#252545"}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        color: "#e0e0f0", fontSize: 14, lineHeight: 1.65,
        fontFamily: "'DM Sans', sans-serif",
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
          width: 6, height: 6, borderRadius: "50%",
          background: "#e8002d",
          animation: "bounce 1.1s infinite",
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
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

  // Simulate — always driven by selectedRace
  const [simDriver, setSimDriver] = useState("VER");
  const [simPitLap, setSimPitLap] = useState(20);
  const [simCompound, setSimCompound] = useState("HARD");
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
  const chatEndRef = useRef(null);

  // Load race list
  useEffect(() => {
    fetch(`${API}/races`)
      .then(r => r.json())
      .then(d => setRaces(d.races || []))
      .catch(() => {});
  }, []);

  // Load race data whenever selectedRace changes
  useEffect(() => {
    if (!selectedRace) { setRaceData(null); return; }
    setRaceLoading(true);
    setRaceData(null);
    setSimResult(null); // clear old sim result when race changes
    fetch(`${API}/race/${selectedRace.year}/${selectedRace.round_number}`)
      .then(r => r.json())
      .then(d => { setRaceData(d); setRaceLoading(false); })
      .catch(() => setRaceLoading(false));
  }, [selectedRace]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleRaceChange(e) {
    const val = e.target.value;
    if (!val) { setSelectedRace(null); return; }
    const [y, r] = val.split("-");
    const race = races.find(x => x.year === parseInt(y) && x.round_number === parseInt(r));
    setSelectedRace(race || null);
  }

  function handleStintClick(driver) {
    setSimDriver(driver);
    setSimResult(null);
    setView("simulate");
  }

  async function runSimulation() {
    if (!selectedRace) return;
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
          alt_pit_lap: parseInt(simPitLap),
          alt_compound: simCompound,
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

  const raceVal = selectedRace ? `${selectedRace.year}-${selectedRace.round_number}` : "";

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

      {/* Header */}
      <header style={{
        borderBottom: "1px solid #16162a", background: "#0a0a0fcc",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 54 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 36 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e8002d", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: 2, color: "#fff" }}>
              PITWALL<span style={{ color: "#e8002d" }}> AI</span>
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 2 }}>
            {[["strategy","STRATEGY MAP"],["simulate","SIMULATE"],["chat","PITWALL AI"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: "5px 14px", border: "none", cursor: "pointer",
                background: view === id ? "#e8002d" : "transparent",
                color: view === id ? "#fff" : "#555",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 12, letterSpacing: 1.5,
                borderRadius: 4, transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </nav>

          {/* Race selector — always visible, drives everything */}
          <div style={{ marginLeft: "auto" }}>
            <select value={raceVal} onChange={handleRaceChange} style={{
              background: "#13132a", border: "1px solid #252545",
              color: raceVal ? "#e8e8f0" : "#555",
              padding: "6px 14px", borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              cursor: "pointer", minWidth: 240,
            }}>
              <option value="">Select a race...</option>
              {races.map(r => (
                <option key={`${r.year}-${r.round_number}`} value={`${r.year}-${r.round_number}`}>
                  {r.year} R{String(r.round_number).padStart(2,"0")} — {r.race_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── STRATEGY MAP ── */}
        {view === "strategy" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>STRATEGY MAP</h1>
              <p style={{ color: "#555", fontSize: 13 }}>Full race tire strategy — every driver, every stint. Click a row to simulate that driver.</p>
            </div>

            {!selectedRace && (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#333", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 2 }}>
                SELECT A RACE FROM THE TOP RIGHT
              </div>
            )}

            {selectedRace && raceLoading && (
              <div style={{ textAlign: "center", padding: "80px 0" }}><Spinner /></div>
            )}

            {raceData && !raceLoading && (
              <>
                {/* Race info bar */}
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
                    {["SOFT","MEDIUM","HARD","INTERMEDIATE"].map(c => (
                      <div key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <TireBadge compound={c} size={20} />
                        <span style={{ fontSize: 11, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{c[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lap axis */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, paddingLeft: 80 }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                    <span key={pct} style={{
                      position: "absolute", left: `calc(80px + 24px + ${pct * 100}% - ${pct === 1 ? 28 : 0}px)`,
                      fontSize: 10, color: "#333", fontFamily: "'Barlow Condensed', sans-serif",
                    }}>L{Math.round(raceData.total_laps * pct) || 1}</span>
                  ))}
                </div>

                {/* Driver rows */}
                <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: "16px 16px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: 4 }}>
                    <span style={{ width: 28 }} />
                    <span style={{ width: 38 }} />
                    <div style={{ flex: 1, display: "flex", justifyContent: "space-between", paddingRight: 34 }}>
                      {[1, Math.round(raceData.total_laps*0.25), Math.round(raceData.total_laps*0.5), Math.round(raceData.total_laps*0.75), raceData.total_laps].map(l => (
                        <span key={l} style={{ fontSize: 10, color: "#333", fontFamily: "'Barlow Condensed', sans-serif" }}>L{l}</span>
                      ))}
                    </div>
                  </div>
                  {raceData.drivers?.map(d => (
                    <DriverRow
                      key={d.driver}
                      driver={d.driver}
                      finish_position={d.finish_position}
                      stints={d.stints || []}
                      totalLaps={raceData.total_laps}
                      onSelect={handleStintClick}
                    />
                  ))}
                </div>
                <p style={{ marginTop: 10, fontSize: 11, color: "#333" }}>
                  Sorted by finish position · Click any row to simulate that driver
                </p>
              </>
            )}
          </div>
        )}

        {/* ── SIMULATE ── */}
        {view === "simulate" && (
          <div style={{ animation: "slideIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>STRATEGY SIMULATOR</h1>
              <p style={{ color: "#555", fontSize: 13 }}>Change history — what if they had pitted differently?</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
              {/* Controls */}
              <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: 22 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: "#444", marginBottom: 18 }}>
                  SIMULATION PARAMETERS
                </div>

                {/* Race indicator */}
                <div style={{ marginBottom: 16, padding: "8px 12px", background: "#13132a", borderRadius: 6, border: "1px solid #1e1e3a" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 3 }}>RACE</div>
                  <div style={{ fontSize: 13, color: selectedRace ? "#e8e8f0" : "#e8002d" }}>
                    {selectedRace ? `${selectedRace.race_name} ${selectedRace.year}` : "← Select a race in the header"}
                  </div>
                </div>

                {/* Driver */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>DRIVER</label>
                  <select value={simDriver} onChange={e => { setSimDriver(e.target.value); setSimResult(null); }}
                    style={{ width: "100%", background: "#13132a", border: "1px solid #1e1e3a", color: "#e8e8f0", padding: "8px 10px", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                    {["VER","NOR","LEC","SAI","HAM","RUS","ALO","STR","PER","GAS","ALB","OCO","BOT","ZHO","MAG","HUL","TSU","RIC","SAR","PIA"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                {/* Compound */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>ALT COMPOUND</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["SOFT","MEDIUM","HARD"].map(c => (
                      <button key={c} onClick={() => { setSimCompound(c); setSimResult(null); }}
                        style={{
                          flex: 1, padding: "8px 4px", border: `2px solid ${simCompound === c ? COMPOUNDS[c].color : "#1e1e3a"}`,
                          background: simCompound === c ? `${COMPOUNDS[c].color}22` : "#13132a",
                          borderRadius: 6, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          transition: "all 0.15s",
                        }}>
                        <TireBadge compound={c} size={18} />
                        <span style={{ fontSize: 10, color: simCompound === c ? "#e8e8f0" : "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>{c[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pit lap slider */}
                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, color: "#444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>
                    ALT PIT LAP: <span style={{ color: "#e8002d", fontSize: 14 }}>LAP {simPitLap}</span>
                  </label>
                  <input type="range" min={3} max={60} value={simPitLap}
                    onChange={e => { setSimPitLap(e.target.value); setSimResult(null); }}
                    style={{ width: "100%", accentColor: "#e8002d", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#333", marginTop: 3 }}>
                    <span>Lap 3</span><span>Lap 60</span>
                  </div>
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
                    transition: "all 0.15s",
                  }}>
                  {simLoading ? "SIMULATING..." : "RUN SIMULATION"}
                </button>
              </div>

              {/* Results */}
              <div style={{ background: "#0f0f1e", border: "1px solid #16162a", borderRadius: 10, padding: 22, minHeight: 400 }}>
                {!simResult && !simLoading && (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "#2a2a4a" }}>
                    <div style={{ fontSize: 52 }}>🏎</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, letterSpacing: 2 }}>CONFIGURE AND RUN A SIMULATION</div>
                  </div>
                )}

                {simLoading && (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spinner />
                  </div>
                )}

                {simResult && !simResult.error && (
                  <div style={{ animation: "slideIn 0.25s ease" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: "#444", marginBottom: 16 }}>
                      RESULTS — {simResult.driver} · {simResult.race} {simResult.year}
                    </div>

                    {/* Delta + position */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {/* Time delta */}
                      <div style={{
                        background: simResult.total_delta_seconds < 0 ? "#00ff8810" : "#ff220010",
                        border: `1px solid ${simResult.total_delta_seconds < 0 ? "#00ff8830" : "#ff220030"}`,
                        borderRadius: 8, padding: "16px 18px",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 6 }}>TIME DELTA</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 40, color: simResult.total_delta_seconds < 0 ? "#00ff88" : "#ff5555" }}>
                          {simResult.total_delta_seconds > 0 ? "+" : ""}{simResult.total_delta_seconds?.toFixed(1)}s
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          {simResult.direction === "faster" ? "faster" : "slower"} in simulation
                        </div>
                      </div>

                      {/* Position impact */}
                      <div style={{
                        background: simResult.simulated_position < simResult.actual_position ? "#00ff8810" :
                                    simResult.simulated_position > simResult.actual_position ? "#ff220010" : "#ffffff08",
                        border: `1px solid ${simResult.simulated_position < simResult.actual_position ? "#00ff8830" :
                                             simResult.simulated_position > simResult.actual_position ? "#ff220030" : "#ffffff15"}`,
                        borderRadius: 8, padding: "16px 18px",
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#555", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 6 }}>POSITION IMPACT</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#666" }}>P{simResult.actual_position}</div>
                          <div style={{ color: "#333", fontSize: 20 }}>→</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32,
                            color: simResult.simulated_position < simResult.actual_position ? "#00ff88" :
                                   simResult.simulated_position > simResult.actual_position ? "#ff5555" : "#e8e8f0"
                          }}>P{simResult.simulated_position}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                          {simResult.simulated_position < simResult.actual_position ? "position gained" :
                           simResult.simulated_position > simResult.actual_position ? "position lost" : "no change"}
                        </div>
                      </div>
                    </div>

                    {/* Position change detail */}
                    {simResult.position_change && (
                      <div style={{
                        background: "#13132a", border: "1px solid #1e1e3a",
                        borderRadius: 7, padding: "10px 14px", marginBottom: 14,
                        fontSize: 13, color: "#aaa",
                      }}>
                        {simResult.position_change}
                      </div>
                    )}

                    {/* Strategy comparison */}
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

                    {/* Summary */}
                    <div style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 7, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                      {simResult.summary}
                    </div>

                    {/* Key laps */}
                    {simResult.key_laps?.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#444", marginBottom: 8 }}>KEY LAP DIFFERENCES</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {simResult.key_laps.map((l, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#13132a", borderRadius: 5, padding: "7px 12px" }}>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: "#555", width: 46 }}>LAP {l.lap}</span>
                              <div style={{ flex: 1, display: "flex", gap: 8, fontSize: 12 }}>
                                <span style={{ color: "#444" }}>{l.actual?.toFixed(3)}s</span>
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

        {/* ── CHAT ── */}
        {view === "chat" && (
          <div style={{ animation: "slideIn 0.25s ease", height: "calc(100vh - 150px)", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 3 }}>PITWALL AI</h1>
              <p style={{ color: "#555", fontSize: 13 }}>Powered by IBM Granite · 72 races · 2022–2025</p>
            </div>

            {/* Suggested questions */}
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
                  fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.target.style.borderColor = "#e8002d33"; e.target.style.color = "#ccc"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#1e1e3a"; e.target.style.color = "#666"; }}
                >{q}</button>
              ))}
            </div>

            {/* Messages */}
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

            {/* Input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about race strategy, tire degradation, or run a what-if simulation..."
                style={{
                  flex: 1, background: "#0f0f1e", border: "1px solid #1e1e3a",
                  borderRadius: 9, color: "#e8e8f0", padding: "11px 15px",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "#e8002d33"}
                onBlur={e => e.target.style.borderColor = "#1e1e3a"}
              />
              <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{
                padding: "11px 18px", background: "#e8002d", border: "none", borderRadius: 9,
                color: "#fff", cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
                opacity: chatLoading || !input.trim() ? 0.4 : 1, transition: "opacity 0.15s",
              }}>SEND</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}