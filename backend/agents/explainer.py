from ai.featherless import call_llm
from agents.trace_summary import trace_slice_signals, trace_slice_summary

def explainer_agent(graph, path, use_llm=True):
    labels = [node.get("label") for node in path or []]
    fallback = {
        "role": "Explainer Agent",
        "verdict": "The selected trace becomes a visible story of computation." if labels else "Trace Target converts the full map into an execution story.",
        "grounding": "Narrative generated from the active trace slice and primary replay path.",
        "confidence": 0.9,
        "llm_status": "local_graph_reasoning",
        "narrative": _narrative_for(graph, path or []),
        "signals": trace_slice_signals(graph, path or []) + _signals_for(graph, path or []),
        "path": labels,
    }

    if not use_llm:
        return fallback

    return call_llm(f"""
Explain this system like a cinematic story:

GRAPH:
{graph}

EXECUTION:
{path}

Explain both layers:
1. Trace Slice Summary: count declarations, imports, and local execution branches visible in the graph.
2. Primary Replay Path: name the single path selected for animation.
3. Branch List: group declares, imports, and calls/continues.
""", fallback=fallback)


def _narrative_for(graph, path):
    if not path:
        return "Analyze Repository gives the full system map. Trace Target turns one selected node into a focused execution story by showing only the downstream causal chain."

    edges = graph.get("edges", [])
    summary = trace_slice_summary(graph, path)
    parts = []
    for index, node in enumerate(path):
        next_node = path[index + 1] if index + 1 < len(path) else None
        edge = _edge_between(edges, node, next_node) if next_node else None
        evidence = _evidence_label(node)
        next_copy = (
            f" It then {edge.get('label')} to {next_node.get('label')}."
            if edge and edge.get("label")
            else f" It then passes control to {next_node.get('label')}."
            if next_node
            else " No further downstream step was discovered from this target."
        )
        parts.append(
            f"Step {index + 1}: {node.get('label')} is a {node.get('layer')} {node.get('type')} node with {node.get('risk', 'none')} risk. "
            f"{node.get('description') or 'Execution advances through the graph.'}{evidence}{next_copy}"
        )

    return (
        f"{summary['summary']} {summary['primary']} "
        f"Branch List: declares: {summary['declares']}; imports: {summary['imports']}; calls/continues: {summary['branches']}. "
        + " ".join(parts)
        + " Focused traces are intentionally smaller than the full repository graph: the canvas shows the selected target's branch context, while replay selects one primary path for animation. If the selected target is terminal, TraceGrid includes the nearest upstream source context so the node remains explainable instead of detached."
    )


def _signals_for(graph, path):
    if not path:
        return []

    edges = graph.get("edges", [])
    signals = [f"Primary replay path length: {len(path)} node{'s' if len(path) != 1 else ''}."]
    for index in range(len(path) - 1):
        edge = _edge_between(edges, path[index], path[index + 1])
        connector = f"--{edge.get('label')}-->" if edge and edge.get("label") else "->"
        signals.append(f"{path[index].get('label')} {connector} {path[index + 1].get('label')}")

    if len(path) == 1:
        signals.append("No downstream edge was discovered from this selected target.")

    return signals


def _edge_between(edges, source, target):
    if not source or not target:
        return None

    for edge in edges:
        if edge.get("from") == source.get("id") and edge.get("to") == target.get("id"):
            return edge
    return None


def _evidence_label(node):
    evidence = node.get("evidence") or {}
    file_name = evidence.get("file")
    line = evidence.get("line")
    detector = evidence.get("detector")
    if file_name and line:
        return f" Evidence: {file_name}:{line} via {detector}."
    return ""
