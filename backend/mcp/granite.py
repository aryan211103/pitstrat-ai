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

SYSTEM_PROMPT = """You are PitWall AI, an expert F1 race strategy analyst.
You have access to real F1 race data and an ML model trained on 72 races (2022-2025).

Your job is to help fans understand race strategy through:
- Explaining what actually happened in races
- Running counterfactual simulations ("what if" scenarios)
- Predicting tire degradation
- Analysing strategic battles between drivers

When answering:
- Always call the relevant tool first to get real data
- Be specific with numbers (lap times, deltas, compounds)
- Explain strategy in simple terms a casual fan can understand
- Use F1 terminology naturally (undercut, overcut, stint, pit window)
- Keep answers engaging and concise

If asked about a race or driver you don't have data for, use list_races to check
what's available and tell the user honestly.
"""

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
    response = model.chat(messages=messages, tools=tools, tool_choice="auto")
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

    max_iterations = 5
    loop = asyncio.get_event_loop()

    for _ in range(max_iterations):
        # Run SDK call in thread pool (it's synchronous)
        response = await loop.run_in_executor(
            None, _call_granite_sync, messages, TOOLS
        )

        choice = response["choices"][0]
        message = choice["message"]
        messages.append(message)

        # No tool call — final answer
        if choice["finish_reason"] == "stop" or not message.get("tool_calls"):
            response_text = message.get("content", "")
            updated_history = messages[1:]  # exclude system prompt
            return response_text, updated_history

        # Handle tool calls
        for tool_call in message.get("tool_calls", []):
            fn = tool_call["function"]
            tool_name = fn["name"]
            try:
                arguments = json.loads(fn["arguments"])
            except (json.JSONDecodeError, TypeError):
                arguments = {}

            tool_result = await _call_mcp_tool(tool_name, arguments)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.get("id", "0"),
                "content": tool_result,
            })

    return "I ran into trouble processing that. Please try rephrasing.", history