"""
chat.py
FastAPI chat endpoint consumed by the React frontend.
Maintains per-session conversation history.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.mcp.granite import chat as granite_chat

app = FastAPI(title="PitStrat AI Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (good enough for demo; replace with Redis for prod)
_sessions: dict[str, list[dict]] = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    response: str
    session_id: str


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    history = _sessions.get(req.session_id, [])
    try:
        response, updated_history = await granite_chat(req.message, history)
        _sessions[req.session_id] = updated_history[-20:]  # keep last 20 turns
        return ChatResponse(response=response, session_id=req.session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    _sessions.pop(session_id, None)
    return {"cleared": True}


@app.get("/health")
async def health():
    return {"status": "ok"}