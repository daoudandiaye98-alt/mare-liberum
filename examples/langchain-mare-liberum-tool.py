"""Mare Liberum as LangChain tools.

    pip install langchain-core requests
    python langchain-mare-liberum-tool.py "latest research on creatine"

Runs as it is (no model needed): it asks the sea for doors, then walks the first /via/ address. Give the three tools
to any LangChain agent (create_agent, a LangGraph ReAct agent, ...) and it does the same on its own.
Every outside address the sea hands out is a /via/ address: the sea fetches the place for you, counts the walk and
makes the path stronger. POST /route?q= is the one paid move (x402); it answers 402 with the terms until it is paid.
"""
import os
import sys

import requests
from langchain_core.tools import tool

SEA = os.environ.get("MARE_SEA", "https://mareliberum.dev")  # another node of the sea: MARE_SEA=http://localhost:8787
HEADERS = {"user-agent": "mare-liberum-example/1.0 (langchain)", "accept": "application/json"}


@tool
def mare_route(task: str) -> list:
    """Doors that answer a program for this task (free): name, a /via/ address to fetch, and what it returns."""
    r = requests.get(f"{SEA}/route", params={"q": task}, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return [{"name": d.get("name"), "to": d.get("to"), "returns": d.get("returns")} for d in r.json().get("doors", []) if d.get("to")][:8]


@tool
def mare_paid_route(task: str) -> dict:
    """The 10 best paths for this task (paid with x402, a few cents in USDC on Base). Unpaid it returns the terms."""
    r = requests.post(f"{SEA}/route", params={"q": task}, headers=HEADERS, timeout=30)
    if r.status_code == 402:
        d = r.json()
        return {"payment_required": d.get("price"), "how_to_pay": d.get("pay")}
    r.raise_for_status()
    return r.json()


@tool
def mare_via(address: str) -> str:
    """Fetch a /via/ address the sea handed out and return what the place answered (first 6000 characters)."""
    if not address.startswith(f"{SEA}/via/"):
        return "only /via/ addresses handed out by the sea"
    r = requests.get(address, headers={"user-agent": HEADERS["user-agent"]}, timeout=30)
    return f"[{r.status_code} from {r.headers.get('x-via-target')}]\n{r.text[:6000]}"


if __name__ == "__main__":
    task = " ".join(sys.argv[1:]) or "latest research on creatine"
    doors = mare_route.invoke({"task": task})
    for d in doors[:3]:
        print(f"- {d['name']}: {d['to']}")
    if doors:
        print(mare_via.invoke({"address": doors[0]["to"]})[:800])
