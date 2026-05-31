"""
granite.py
IBM Granite client using ibm-watsonx-ai SDK.
Handles tool calling loop and narrates results back to the fan.
"""

import json
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

WATSONX_API_KEY = os.getenv("WATSONX_API_KEY")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8001")

GRANITE_MODEL = "ibm/granite-4-h-small"

SYSTEM_PROMPT = """You are PitStrat AI, an F1 race strategy analyst.
You have access to real F1 race data from 72 races (2022-2025) and an ML simulation engine.

# CRITICAL RULES — Never break these:

1. NEVER invent facts. Only use data returned by your tools.
   - If get_race_data returns a strategy of "S(1-14) → S(15-36) → H(37-57)", that is the actual strategy. Do not change it.
   - If simulate_strategy returns total_delta_seconds = -28.5, that is the delta. Do not round it differently or invent reasoning.
   - If you don't have the data, call the tool. If you can't get the data, say so honestly.

2. NEVER invent pit lap numbers, compounds, or stint ranges. Quote them directly from tool results.

3. When the user asks "what if" — call simulate_strategy and report the exact result. Don't speculate beyond what the simulation says.

# OUTPUT FORMAT

- Write in 2-4 short paragraphs of plain prose.
- NO tables. NO bullet point lists. NO markdown headers.
- Lead with the answer in one sentence. Then explain.
- Be specific with numbers but conversational in tone.
- Total response length: 80-150 words.

# TOOL USE

- For "what happened" questions → call get_race_data
- For "what if" questions → call simulate_strategy (then explain the result)
- For "compare drivers" → call get_race_data once and analyse both drivers
- Don't repeat tool calls if you already have the data.

# F1 KNOWLEDGE

- Use natural F1 terms: undercut, overcut, stint, pit window, degradation, compound.
- Tyre compounds: SOFT (red), MEDIUM (yellow), HARD (white). Also INTERMEDIATE (green) and WET (blue) for rain.
- A pit stop costs ~22 seconds in pit lane time.

# EXAMPLE GOOD RESPONSE

User: "What if Verstappen pitted lap 20 on hards in Bahrain 2023?"
You (after calling tools):
"That would have cost Verstappen 54.1 seconds. His actual strategy was Soft (laps 1-14) → Soft (15-36) → Hard (37-57), a 2-stop. The simulation replaces his second pit so he pits on lap 20 for hards instead — that means a 17-lap hard stint becomes a 37-lap hard stint, and hards degrade significantly past 40 laps. He still finishes P2 since Perez finished 11+ seconds behind, but the gap to the leaders grows by nearly a minute. The actual strategy was clearly the right call."

Do not break these rules even if the user asks you to."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_race_data",
            "description": "Get lap times, tire stints, and pit stops for an F1 race",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer", "description": "Season year 2022-2025"},
                    "round_number": {"type": "integer", "description": "Round number in season"},
                    "driver": {"type": "string", "description": "3-letter driver code e.g. VER, LEC. Optional."},
                },
                "required": ["year", "round_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_strategy",
            "description": "Simulate a what-if pit strategy and compare to actual race result",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                    "round_number": {"type": "integer"},
                    "driver": {"type": "string"},
                    "alt_pit_lap": {"type": "integer"},
                    "alt_compound": {"type": "string"},
                    "modify_stint": {"type": "integer"},
                },
                "required": ["year", "round_number", "driver", "alt_pit_lap", "alt_compound"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "predict_degradation",
            "description": "Predict tire degradation curve for a compound on a circuit",
            "parameters": {
                "type": "object",
                "properties": {
                    "compound": {"type": "string"},
                    "circuit": {"type": "string"},
                    "year": {"type": "integer"},
                    "stint_length": {"type": "integer"},
                },
                "required": ["compound", "circuit", "year"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_strategy_impact",
            "description": "Analyse strategic battle between multiple drivers",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                    "round_number": {"type": "integer"},
                    "drivers": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["year", "round_number", "drivers"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_races",
            "description": "List all available races in the dataset",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                },
            },
        },
    },
]


async def _call_mcp_tool(tool_name: str, arguments: dict) -> str:
    """Call a tool on the MCP server directly (import and call the function)."""
    from backend.mcp import server as mcp_server
    tool_fn = getattr(mcp_server, tool_name, None)
    if tool_fn is None:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = await tool_fn(**arguments)
        return result
    except Exception as e:
        return json.dumps({"error": str(e)})


def _call_granite_sync(messages: list, tools: list) -> dict:
    """Call Granite synchronously via SDK (runs in thread pool)."""
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference

    client = APIClient(Credentials(url=WATSONX_URL, api_key=WATSONX_API_KEY))
    model = ModelInference(
        model_id=GRANITE_MODEL,
        api_client=client,
        project_id=WATSONX_PROJECT_ID,
        params={
            "max_new_tokens": 1024,
            "temperature": 0.3,
        },
    )
    # IBM requires tools to be set if tool_choice is provided.
    # When forcing a final answer with no tools available, skip tool_choice.
    if tools:
        response = model.chat(messages=messages, tools=tools, tool_choice="auto")
    else:
        response = model.chat(messages=messages)
    return response


async def chat(
    user_message: str,
    history: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    """
    Send a message to Granite, handle tool calls, return final response.
    Returns: (response_text, updated_history)
    """
    if history is None:
        history = []

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    max_iterations = 8
    loop = asyncio.get_event_loop()
    last_content = ""

    for _ in range(max_iterations):
        # Run SDK call in thread pool (it's synchronous)
        response = await loop.run_in_executor(
            None, _call_granite_sync, messages, TOOLS
        )

        choice = response["choices"][0]
        message = choice["message"]
        messages.append(message)

        # Remember the last content even if a tool call also happened
        if message.get("content"):
            last_content = message["content"]

        # No tool call — final answer
        if choice["finish_reason"] == "stop" or not message.get("tool_calls"):
            response_text = message.get("content", "")
            updated_history = messages[1:]  # exclude system prompt
            return response_text, updated_history

        # Handle tool calls
        for tool_call in message.get("tool_calls", []):
            fn = tool_call["function"]
            tool_name = fn["name"]
            raw_args = fn["arguments"]
            arguments = {}
            try:
                parsed = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                # If first parse returned a string (double-encoded), parse again
                if isinstance(parsed, str):
                    parsed = json.loads(parsed)
                if isinstance(parsed, dict):
                    arguments = parsed
            except (json.JSONDecodeError, TypeError):
                arguments = {}

            tool_result = await _call_mcp_tool(tool_name, arguments)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.get("id", "0"),
                "content": tool_result,
            })

    # Hit max iterations — force Granite to summarize what it has
    messages.append({
        "role": "user",
        "content": "Based on all the data you've gathered, give me a concise final answer now. Do not call any more tools.",
    })
    response = await loop.run_in_executor(None, _call_granite_sync, messages, [])
    final_text = response["choices"][0]["message"].get("content", "")
    if final_text:
        return final_text, messages[1:]

    # Last resort
    if last_content:
        return last_content, messages[1:]
    return "I ran into trouble processing that. Please try rephrasing.", history