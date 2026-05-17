from agents.trace_summary import trace_slice_signals


def architecture_agent(graph, path=None):
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    metadata = graph.get("metadata", {})
    layers = {}

    for node in nodes:
        layer = node.get("layer", "Unknown")
        layers[layer] = layers.get(layer, 0) + 1

    path_labels = [step.get("label") for step in path or []]

    return {
        "role": "Architecture Agent",
        "verdict": "The system is reconstructed as a causal graph across UI, API, security, backend, and data layers.",
        "grounding": "Derived from graph nodes, edges, and the selected execution path.",
        "confidence": 0.91,
        "signals": [
            f"{len(nodes)} nodes and {len(edges)} causal edges discovered.",
            f"Analyzer mode: {metadata.get('analyzer', metadata.get('mode', 'unknown'))}.",
            f"Layer coverage: {', '.join(f'{name}={count}' for name, count in sorted(layers.items()))}.",
            f"Active path: {' -> '.join(path_labels) if path_labels else 'No path selected.'}",
            *trace_slice_signals(graph, path or []),
        ],
    }
