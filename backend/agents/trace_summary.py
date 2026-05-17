STRUCTURAL_EDGE_LABELS = {"declares", "imports"}


def trace_slice_signals(graph, path=None):
    summary = trace_slice_summary(graph, path)
    return [
        summary["summary"],
        summary["primary"],
        f"Branch List - declares: {summary['declares']}",
        f"Branch List - imports: {summary['imports']}",
        f"Branch List - calls/continues: {summary['branches']}",
    ]


def trace_slice_summary(graph, path=None):
    path = path or []
    lookup = _node_lookup(graph)
    selected = _selected_node(graph, path)
    selected_id = selected.get("id") if selected else None
    subject = "This file" if _is_file_node(selected) else "This focused trace slice"

    declarations = _relationship_targets(graph, lookup, selected_id, "declares")
    imports = _relationship_targets(graph, lookup, selected_id, "imports")
    branch_edges = _branch_edges(graph, lookup)
    branch_pairs = [_edge_pair(edge, lookup) for edge in branch_edges]

    return {
        "summary": (
            f"Trace Slice Summary: {subject} declares {len(declarations)} functions/classes, "
            f"imports {len(imports)} dependencies, and connects to {len(branch_edges)} local execution branches."
        ),
        "primary": f"Primary Replay Path: The current replay path selected for animation is {_path_label(path)}.",
        "declares": _format_list(declarations),
        "imports": _format_list(imports),
        "branches": _format_list(branch_pairs),
    }


def _node_lookup(graph):
    return {node.get("id"): node for node in graph.get("nodes", []) if node.get("id")}


def _selected_node(graph, path):
    if path:
        return path[0]
    nodes = graph.get("nodes", [])
    return nodes[0] if nodes else None


def _is_file_node(node):
    if not node:
        return False
    return node.get("type") in {"file", "code"} or node.get("layer") == "Code"


def _relationship_targets(graph, lookup, selected_id, label):
    if not selected_id:
        return []

    targets = []
    seen = set()
    for edge in graph.get("edges", []):
        if edge.get("from") != selected_id or edge.get("label") != label:
            continue
        target_id = edge.get("to")
        label_text = _label_for(lookup, target_id)
        if label_text not in seen:
            seen.add(label_text)
            targets.append(label_text)
    return targets


def _branch_edges(graph, lookup):
    edges = []
    seen = set()
    for edge in graph.get("edges", []):
        label = str(edge.get("label") or "").lower()
        if label in STRUCTURAL_EDGE_LABELS:
            continue
        if edge.get("from") not in lookup or edge.get("to") not in lookup:
            continue
        key = (edge.get("from"), edge.get("to"), label)
        if key in seen:
            continue
        seen.add(key)
        edges.append(edge)
    return edges


def _edge_pair(edge, lookup):
    connector = f"--{edge.get('label')}-->" if edge.get("label") else "->"
    return f"{_label_for(lookup, edge.get('from'))} {connector} {_label_for(lookup, edge.get('to'))}"


def _path_label(path):
    if not path:
        return "no replay path selected"
    return " -> ".join(node.get("label", node.get("id", "unknown")) for node in path)


def _label_for(lookup, node_id):
    node = lookup.get(node_id, {})
    return node.get("label") or node_id or "unknown"


def _format_list(items, limit=8):
    if not items:
        return "none detected in this slice"
    visible = items[:limit]
    suffix = f", +{len(items) - limit} more" if len(items) > limit else ""
    return ", ".join(visible) + suffix
