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

### Three core features:

**1. Strategy Map**
Visualise every driver's complete tyre strategy for any race — sorted by finish position, with compound colour coding and degradation data on hover.

**2. Strategy Simulator**
Change history. Pick a driver, choose a different pit lap and tyre compound, and see what would have happened — including time delta and position impact (with named drivers overtaken or lost to).

**3. PitWall AI Chat**
Ask anything in natural language. IBM Granite calls the ML engine through MCP tools and narrates the answer like a race engineer. "What if Verstappen pitted earlier?" gets a full lap-by-lap breakdown.

---

## Why It Matters in Racing

- Race engineers make pit decisions in under 10 seconds with incomplete information
- A 2-second tyre strategy error can cost a race win (see: Monaco 2022, Abu Dhabi 2021)
- Our counterfactual engine lets fans, analysts, and teams replay decisions with actual data
- The multi-car strategy impact model shows how one pit stop ripples through the field — the undercut/overcut dynamic that decides championships

---

## AI & Technical Approach

### IBM Tools Used
- **IBM Granite (`ibm/granite-4-h-small`)** via watsonx.ai — the LLM that reasons over race data, calls MCP tools, and narrates strategy analysis in natural language
- **Context Forge (MCP gateway)** — exposes 5 typed tools (`get_race_data`, `simulate_strategy`, `predict_degradation`, `get_strategy_impact`, `list_races`) that Granite calls to ground its responses in real data

### ML Engine
- **XGBoost tire degradation model** trained on 79,273 lap records across 72 races (2022–2025)
- Features: compound type, tire age, stint number, lap number, circuit encoding, season year
- Validation MAE: ~1.95s per lap (circuit-level prediction on unseen races)
- **Pit window optimizer**: brute-force search over all possible pit laps and compounds to minimise total remaining race time
- **Counterfactual simulator**: replaces a stint with an alternate strategy, runs both paths through the same ML model (so prediction errors cancel), and reports the pure strategy delta

### Key design decision
Rather than comparing ML-predicted times against actual recorded times (which introduces model error as a confound), the simulator compares **ML-predicted actual vs ML-predicted simulated** for the changed portion. This means the delta reflects only the strategic difference, not model inaccuracy.

### Data
- **FastF1** Python library for historical F1 data (lap times, tire compounds, pit stops, positions)
- 72 races across 4 seasons, 79K+ lap records, 2,681 pit stops, 3,614 stints
- Covers all circuit types: high-deg (Bahrain), low-deg (Monaco), street circuits, wet races

### Architecture
```
React Frontend (Vite)
    ↓ REST API
FastAPI Backend
    ├── /race/{year}/{round}  → parser.py → parquet cache
    ├── /simulate             → simulator.py → XGBoost model
    └── /chat                 → granite.py → IBM watsonx SDK
                                    ↓ tool calls
                              MCP tools (server.py)
                                    ↓
                              ML engine (degradation, optimizer, simulator)
```

---

## Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+
- IBM watsonx.ai account (free tier works)

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/pitstrat-ai
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

### 3. Ingest race data (first time only, ~45 minutes)
```bash
python -m backend.ingestion --year 2023
python -m backend.ingestion --year 2024
```

### 4. Train the ML model
```bash
python -m backend.ml.train
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
│   ├── main.py              # FastAPI server
│   ├── ingestion.py         # FastF1 data loader
│   ├── parser.py            # Parquet → typed objects
│   ├── models.py            # Pydantic schemas
│   ├── ml/
│   │   ├── features.py      # Feature engineering
│   │   ├── degradation.py   # XGBoost model
│   │   ├── optimizer.py     # Pit window optimizer
│   │   ├── simulator.py     # Counterfactual engine
│   │   └── train.py         # Training script
│   └── mcp/
│       ├── server.py        # FastMCP tools (5 tools)
│       └── granite.py       # IBM Granite SDK client
├── frontend/
│   └── src/App.jsx          # React app (3 views)
├── data/
│   ├── processed/           # 72 races as parquet
│   └── models/              # Trained XGBoost + encoders
└── requirements.txt
```

---

## Judging Criteria Alignment

| Criterion | How we address it |
|-----------|-------------------|
| **Technical Execution** | XGBoost trained on 79K laps, MCP tool architecture, FastAPI + React full stack |
| **Innovation** | Counterfactual simulator with ML-vs-ML comparison; multi-car strategy ripple effect; fan-facing race engineer AI |
| **Challenge Fit** | Direct F1 strategy application; covers teams, drivers, and fans |
| **Feasibility** | Running prototype with real data; extensible to live race data via FastF1 streaming |

---

## Team
Built for the IBM SkillsBuild AI Builders Challenge, May 2026.
