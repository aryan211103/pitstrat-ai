# PitWall AI — F1 Race Strategy Simulator

> **IBM SkillsBuild AI Builders Challenge — May 2026**
> Built with IBM Granite · Context Forge MCP · XGBoost · FastAPI · React

---

## The Problem

F1 race strategy is one of the most complex real-time decision problems in sport. Teams process thousands of data points per second to answer one question: **when should we pit, and on which tyre?**

Fans watch races without understanding *why* decisions are made — or how differently things could have played out. Teams have million-dollar tools. Fans have commentary.

**PitWall AI bridges that gap.**

---

## What It Does

PitWall AI is a full-stack AI application that lets anyone analyse and simulate F1 race strategy using real historical data from 72 races (2022–2025).

### Five core features:

**1. Strategy Map**
Visualise every driver's complete tyre strategy for any race in a Mercedes pit-wall-inspired live timing tower. Drivers shown sorted by finish position with team colour stripes, country flags, tyre compound markers on each stint, lap tick marks, and hover tooltips showing average lap time and degradation rate per stint.

**2. Strategy Simulator (Pit Wall Editor)**
Edit any driver's race like a real race engineer. Pick a driver, change starting tyre, add or remove pit stops, slide pit laps lap-by-lap, swap compounds. The simulator returns time delta, position change (with named drivers overtaken or lost to), tyre life warnings on over-stretched stints, and a SIMULATED TOP 6 standings table with both Gap and Interval columns like a real F1 broadcast.

**3. Strategy Battle (Head-to-Head)**
Pick any two drivers from the same race. See their actual strategies side-by-side with a cumulative lap-by-lap time delta chart that reveals exactly where the race was won and lost. Plus a Key Moments table showing the 5 biggest single-lap deltas.

**4. What-If Compare**
Simulate alternate strategies for 2-3 drivers in parallel. Edit each driver's pit stops independently, hit RUN, see who would have won under different strategic choices. Solves "could LEC have beaten VER if he pitted later?" in one click.

**5. PitWall AI Chat**
Ask anything in natural language. IBM Granite calls the ML engine through MCP tools and narrates the answer like a race engineer. "What if Verstappen pitted lap 20 on hards in Bahrain 2023?" triggers a chain: list_races → get_race_data → simulate_strategy → natural language summary with real numbers.

**Bonus: Model Telemetry page** — Full transparency on the ML model. MAE, RMSE, R², feature importance, predicted-vs-actual scatter, residual distribution, accuracy by tyre compound.

---

## Why It Matters in Racing

- Race engineers make pit decisions in under 10 seconds with incomplete information
- A 2-second tyre strategy error can cost a race win (Monaco 2022, Abu Dhabi 2021)
- Our counterfactual engine lets fans, analysts, and teams replay decisions with actual data
- Strategy Battle shows the lap-by-lap story behind every gap — what commentators describe in 30 seconds, we render as a chart

---

## AI & Technical Approach

### IBM Tools Used
- **IBM Granite (`ibm/granite-4-h-small`)** via watsonx.ai — the LLM that reasons over race data, calls MCP tools, and narrates strategy analysis in natural language
- **Context Forge (MCP gateway)** — exposes 5 typed tools (`list_races`, `get_race_data`, `simulate_strategy`, `get_tire_degradation`, `compare_drivers`) that Granite calls to ground its responses in real data, never hallucinated

### ML Engine
- **XGBoost tire degradation model** trained on 71,999 lap records across 72 races (2022–2025)
- Features: compound type, tire age (linear + squared), stint number, lap number, is_first_stint, circuit encoding, season year
- **Validation metrics:**
  - MAE: 1.95s per lap
  - RMSE: 4.33s
  - R²: 0.8746 (87.5% variance explained)
- **Feature importance:** circuit (49.5%), compound (14.8%), year (11.7%), lap (6.8%), stint (6.1%), tire age (7.7% combined)
- **Counterfactual simulator** replaces stints with alternate strategies, runs both paths through the same model (so prediction errors cancel), and reports pure strategy delta plus pit stop time loss

### Key design decision
Rather than comparing ML-predicted times against actual recorded times (which would conflate model error with strategy difference), the simulator compares **ML-predicted actual vs ML-predicted simulated**. The delta reflects only the strategic choice, not model inaccuracy. Pit stop time loss (~22s per stop) is added separately so the total delta is honest.

### Position estimation
F1 race position cannot be perfectly reconstructed from cumulative lap times (formation laps, lapped cars, missing timing data complicate things). We anchor each driver's race time to their actual finish position, then apply the simulated delta — this preserves real-race ordering while still reflecting strategy changes accurately at the neighbour level.

### Data
- **FastF1** Python library for historical F1 data (lap times, tire compounds, pit stops, positions)
- 72 races across 4 seasons (2022–2025), 79K+ lap records, 2,681 pit stops, 3,614 stints
- Covers all circuit types: high-deg (Bahrain), low-deg (Monaco), street circuits (Singapore, Baku), wet races (Australia 2025)

### Architecture
```
React Frontend (Vite, dark F1-themed UI with animated grid + scanlines)
    ↓ REST API
FastAPI Backend
    ├── /race/{year}/{round}              → parser.py → parquet cache
    ├── /simulate                         → simulator.py → XGBoost
    ├── /simulate_multi                   → batch simulation for compare
    ├── /compare/{y}/{r}/{a}/{b}          → head-to-head lap deltas
    ├── /model_metrics                    → saved evaluation JSON
    └── /chat                             → granite.py → IBM watsonx SDK
                                                ↓ tool calls
                                          MCP server (5 tools)
                                                ↓
                                          ML engine (degradation, simulator, race_simulator)
```

---

## Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+
- IBM watsonx.ai account (free tier works)

### 1. Clone and install
```bash
git clone https://github.com/aryan211103/pitstrat-ai
cd pitstrat-ai
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your IBM watsonx credentials:
# WATSONX_API_KEY=...
# WATSONX_PROJECT_ID=...
# WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

### 3. Ingest race data (first time only, ~45 minutes for all 4 seasons)
```bash
python -m backend.ingestion --year 2022
python -m backend.ingestion --year 2023
python -m backend.ingestion --year 2024
python -m backend.ingestion --year 2025
```

### 4. Train the ML model and compute evaluation metrics
```bash
python -m backend.ml.train
python -m backend.ml.evaluate
```

### 5. Run
```bash
# Terminal 1 — Backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Project Structure
```
pitstrat-ai/
├── backend/
│   ├── main.py              # FastAPI server (8 endpoints)
│   ├── ingestion.py         # FastF1 data loader
│   ├── parser.py            # Parquet → typed objects
│   ├── models.py            # Pydantic schemas
│   ├── ml/
│   │   ├── features.py      # Feature engineering
│   │   ├── degradation.py   # XGBoost model
│   │   ├── simulator.py     # Counterfactual engine (multi-pit)
│   │   ├── race_simulator.py # Position estimation
│   │   ├── train.py         # Training script
│   │   └── evaluate.py      # Metrics + feature importance JSON
│   └── mcp/
│       ├── server.py        # FastMCP tools (5 tools)
│       ├── granite.py       # IBM Granite SDK client
│       └── chat.py          # Chat handler
├── frontend/
│   └── src/
│       ├── App.jsx          # React app (5 views)
│       ├── f1Data.js        # Team colours + driver flags
│       ├── index.css        # Global styles (grid background, animations)
│       └── main.jsx
├── data/
│   ├── processed/           # 72 races as parquet
│   └── models/              # Trained XGBoost + evaluation JSON
└── requirements.txt
```

---

## Judging Criteria Alignment

| Criterion | How we address it |
|-----------|-------------------|
| **Technical Execution** | XGBoost trained on 72K laps with R²=0.87; 5 MCP tools with strict typed schemas; FastAPI + React full stack; transparent Model Evaluation page proving model quality |
| **Innovation** | Counterfactual simulator with ML-vs-ML comparison; head-to-head lap-by-lap delta charts; multi-driver parallel what-if simulation; fan-facing race engineer AI grounded in real data |
| **Challenge Fit** | Direct F1 strategy application; covers race fans, analysts, and broadcast use cases |
| **Feasibility** | Running prototype with 4 seasons of real data; extensible to live race data via FastF1 streaming |
| **Use of IBM Tech** | IBM Granite drives all natural language reasoning; every chat response is grounded in MCP tool calls so the LLM cannot fabricate F1 numbers |

---

## Demo Scenarios

**1. Spain 2022 — PER could have won**
- Open Strategy Map → 2022 R06 Spanish GP → see PER finished P2 behind VER by ~13s
- Open Simulator → pick PER → change strategy to Medium start, pit lap 24 → Hard, pit lap 48 → Medium
- Result: PER finishes 28.5s faster, takes P1 from VER. Strategy alone could have won him the race.

**2. Strategy Battle — Bahrain 2023 RUS vs VER**
- Open Compare → pick RUS and VER → see the cumulative delta chart showing VER pulled away in his first stint, then RUS clawed back during the pit cycle

**3. Granite chat — natural language counterfactual**
- Ask: "What if Verstappen pitted lap 20 on hards in Bahrain 2023?"
- Granite calls list_races → get_race_data → simulate_strategy and returns a 130-word race-engineer-style explanation with real numbers

---

## Team
Built for the IBM SkillsBuild AI Builders Challenge, May 2026.

Aryan Hirlekar · MS Computer Science, Northeastern University · [GitHub](https://github.com/aryan211103) · [LinkedIn](https://linkedin.com/in/aryan-hirlekar)
