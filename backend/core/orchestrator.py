import os

from fastapi import APIRouter, HTTPException
from analyzer.static_analyzer import RepositoryAnalysisError, analyze_repo
from core.execution_engine import build_execution_path, build_trace_slice
from core.timeline import build_timeline
from agents.architecture import architecture_agent
from agents.execution import execution_agent
from agents.security import security_agent
from agents.explainer import explainer_agent

router = APIRouter()

@router.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "demo-safe",
        "message": "TraceGrid API is ready"
    }


@router.post("/analyze")
def analyze(payload: dict):
    repo = payload.get("repo", "__demo__")
    try:
        return analyze_repo(repo)
    except RepositoryAnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/execute")
def execute(payload: dict):
    repo = payload.get("repo", "__demo__")
    event = payload.get("event", "LoginButton")
    target_id = payload.get("target_id")

    try:
        graph = analyze_repo(repo)
    except RepositoryAnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    path = build_execution_path(graph, event, target_id)
    if not path:
        raise HTTPException(
            status_code=404,
            detail=f"Trace target '{event}' was not found in the analyzed graph. Choose a node from the Trace Target suggestions.",
        )

    timeline = build_timeline(path)
    trace_slice = build_trace_slice(graph, event, path, target_id)

    return {
        "graph": graph,
        "trace_slice": trace_slice,
        "execution_path": path,
        "timeline": timeline
    }


@router.post("/agents")
def run_agents(payload: dict):

    graph = payload["graph"]
    path = payload.get("execution_path") or build_execution_path(graph, "LoginButton")
    live_agent = os.getenv("TRACEGRID_LIVE_AGENT", "none").strip().lower()

    return {
        "architecture": architecture_agent(graph, path),
        "execution": execution_agent(graph, path, use_llm=live_agent == "execution"),
        "security": security_agent(graph, use_llm=live_agent == "security"),
        "explainer": explainer_agent(graph, path, use_llm=live_agent == "explainer")
    }
