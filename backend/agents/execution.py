from ai.featherless import call_llm
from agents.trace_summary import trace_slice_signals

def execution_agent(graph, path, use_llm=False):
    labels = [node.get("label") for node in path or []]
    fallback = {
        "role": "Execution Agent",
        "verdict": "The selected target resolves to a trace slice with a replayable primary path." if labels else "The full graph is loaded; choose a Trace Target to isolate a runtime-causal path.",
        "grounding": "Derived from the selected trace slice, branch list, and primary replay path.",
        "confidence": 0.93,
        "llm_status": "local_graph_reasoning",
        "signals": trace_slice_signals(graph, path or []),
        "steps": [
            {
                "step": node.get("step", index + 1),
                "node_id": node.get("id"),
                "label": node.get("label"),
                "layer": node.get("layer"),
                "effect": node.get("description"),
            }
            for index, node in enumerate(path or [])
        ],
    }

    if not use_llm:
        return fallback

    return call_llm(f"""
Reconstruct execution flow:

GRAPH:
{graph}

PATH:
{path}

Explain both layers:
1. Trace Slice Summary: count declarations, imports, and local execution branches visible in the graph.
2. Primary Replay Path: name the single path selected for animation.
3. Branch List: group declares, imports, and calls/continues.
""", fallback=fallback)
