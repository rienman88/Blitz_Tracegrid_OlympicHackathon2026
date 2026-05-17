PHASE_COPY = {
    "ui": "User intent enters the interface.",
    "event": "The click is converted into executable control flow.",
    "api": "The browser crosses the network boundary.",
    "handler": "Backend logic receives and validates the request.",
    "middleware": "Security policy should be enforced here.",
    "db": "The flow touches persistent identity or session data.",
    "service": "Backend service logic produces the runtime outcome.",
    "file": "Static source structure contributes to the flow.",
}


def build_timeline(path):
    timeline = []

    for index, node in enumerate(path):
        node_type = node.get("type", "unknown")
        timeline.append({
            "index": index,
            "node_id": node.get("id"),
            "label": node.get("label"),
            "layer": node.get("layer", "Unknown"),
            "risk": node.get("risk", "none"),
            "phase": PHASE_COPY.get(node_type, "Execution advances through the graph."),
            "duration_ms": 650,
        })

    return timeline
