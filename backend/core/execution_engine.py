DEMO_PATH = [
    "ui-login-button",
    "event-onclick",
    "api-auth-login",
    "auth-handler",
    "auth-middleware",
    "user-db-query",
    "token-service",
    "session-store",
]

TRACE_SLICE_MAX_NODES = 42
TRACE_SLICE_MAX_EDGES = 72
TRACE_SLICE_MAX_DEPTH = 5


def _node_lookup(graph):
    return {node["id"]: node for node in graph.get("nodes", [])}


def _decorate_path(ids, lookup):
    path = []
    for index, node_id in enumerate(ids):
        node = lookup.get(node_id)
        if not node:
            continue
        path.append({
            "step": index + 1,
            "id": node["id"],
            "label": node.get("label", node["id"]),
            "type": node.get("type", "unknown"),
            "layer": node.get("layer", "Unknown"),
            "risk": node.get("risk", "none"),
            "confidence": node.get("confidence"),
            "evidence": node.get("evidence"),
            "description": node.get("description", ""),
        })
    return path


def _bfs_path(graph, start_id):
    edges = graph.get("edges", [])
    adjacency = {}
    for edge in edges:
        adjacency.setdefault(edge["from"], []).append(edge["to"])

    path = [start_id]
    current = start_id
    visited = {start_id}

    while adjacency.get(current):
        next_id = next((candidate for candidate in adjacency[current] if candidate not in visited), None)
        if not next_id:
            break
        path.append(next_id)
        visited.add(next_id)
        current = next_id

    return path


def _edge_sort_key(edge, lookup):
    target = lookup.get(edge.get("to")) or lookup.get(edge.get("from")) or {}
    type_priority = {
        "api": 0,
        "handler": 1,
        "function": 2,
        "service": 3,
        "db": 4,
        "class": 5,
        "import": 6,
        "file": 7,
    }

    return (
        type_priority.get(target.get("type", "unknown"), 9),
        edge.get("label", ""),
        target.get("label", ""),
    )


def _edge_id(edge):
    return f"{edge.get('from')}->{edge.get('to')}::{edge.get('label', '')}"


def _find_start_node(graph, event_text, target_id=None):
    if target_id:
        exact = _node_lookup(graph).get(str(target_id))
        if exact:
            return exact

    return next(
        (
            node
            for node in graph.get("nodes", [])
            if event_text in node.get("label", "").lower()
            or event_text in node.get("id", "").lower()
        ),
        None,
    )


def _default_start_node(graph):
    return next(
        (
            node
            for node in graph.get("nodes", [])
            if node.get("type") in ["ui", "event", "api", "file"]
        ),
        None,
    )


def _incoming_context_path(graph, start_id, lookup, limit=2):
    edges = graph.get("edges", [])
    incoming = {}
    for edge in edges:
        incoming.setdefault(edge["to"], []).append(edge["from"])

    path = [start_id]
    current = start_id
    visited = {start_id}

    for _ in range(limit):
        candidates = [
            candidate
            for candidate in incoming.get(current, [])
            if candidate in lookup and candidate not in visited
        ]
        if not candidates:
            break

        parent = _best_context_parent(candidates, lookup)
        path.insert(0, parent)
        visited.add(parent)
        current = parent

    return path


def build_trace_slice(graph, event, path=None, target_id=None):
    lookup = _node_lookup(graph)
    event_text = str(event or "").lower().strip()

    if all(node_id in lookup for node_id in DEMO_PATH) and event_text in {
        "",
        "login",
        "loginbutton",
        "login button",
        "user logs in",
        "user login",
    }:
        return _slice_from_ids(graph, DEMO_PATH, "Focused runtime path: LoginButton full execution chain.")

    start = _find_start_node(graph, event_text, target_id)
    if not start and not event_text:
        start = _default_start_node(graph)
    if not start:
        return _slice_from_ids(graph, [step.get("id") for step in path or []], "Focused trace path.")

    edges = graph.get("edges", [])
    incoming = {}
    outgoing = {}
    scoped_edges = _scope_edges_for_start(graph, start)
    for edge in scoped_edges:
        outgoing.setdefault(edge["from"], []).append(edge)
        incoming.setdefault(edge["to"], []).append(edge)

    included_nodes = {start["id"]}
    included_edges = []
    edge_ids = set()

    def add_edge(edge):
        if len(included_edges) >= TRACE_SLICE_MAX_EDGES:
            return
        edge_key = _edge_id(edge)
        if edge_key in edge_ids:
            return
        if edge.get("from") not in lookup or edge.get("to") not in lookup:
            return
        edge_ids.add(edge_key)
        included_edges.append(edge)
        included_nodes.add(edge["from"])
        included_nodes.add(edge["to"])

    for edge in sorted(incoming.get(start["id"], []), key=lambda item: _edge_sort_key(item, lookup)):
        add_edge(edge)

    frontier = [(start["id"], 0)]
    visited = {start["id"]}
    while frontier and len(included_nodes) < TRACE_SLICE_MAX_NODES:
        current, depth = frontier.pop(0)
        if depth >= TRACE_SLICE_MAX_DEPTH:
            continue

        branch_edges = sorted(outgoing.get(current, []), key=lambda item: _edge_sort_key(item, lookup))
        for edge in branch_edges:
            if len(included_nodes) >= TRACE_SLICE_MAX_NODES:
                break
            add_edge(edge)
            target = edge["to"]
            if target not in visited:
                visited.add(target)
                frontier.append((target, depth + 1))

    if len(included_nodes) == 1:
        context_path = _incoming_context_path(graph, start["id"], lookup)
        return _slice_from_ids(
            graph,
            context_path,
            f"Terminal trace target with upstream source context: {' -> '.join(_label_for(lookup, node_id) for node_id in context_path)}",
        )

    ordered_ids = _order_slice_nodes(start["id"], included_nodes, incoming, outgoing, lookup)
    scope_label = _scope_label(start)
    summary = (
        f"Focused trace slice for {start.get('label', start['id'])}: "
        f"{len(included_nodes)} connected nodes, {len(included_edges)} strict scoped edges"
        f"{f' from {scope_label}' if scope_label else ''}."
    )
    return _graph_subset(graph, ordered_ids, included_edges, summary)


def _scope_edges_for_start(graph, start):
    edges = graph.get("edges", [])
    start_type = start.get("type")
    start_file = _evidence_file(start)

    if start_type in {"file", "function", "handler", "class", "api", "event", "middleware", "db", "service"} and start_file:
        return [edge for edge in edges if _edge_evidence_file(edge) == start_file]

    if start_type == "import" and start_file:
        return [
            edge
            for edge in edges
            if _edge_evidence_file(edge) == start_file
            and (edge.get("from") == start.get("id") or edge.get("to") == start.get("id"))
        ]

    return edges


def _scope_label(node):
    evidence_file = _evidence_file(node)
    return evidence_file if evidence_file and not evidence_file.startswith("demo://") else ""


def _evidence_file(node):
    evidence = node.get("evidence") or {}
    return evidence.get("file")


def _edge_evidence_file(edge):
    evidence = edge.get("evidence") or {}
    return evidence.get("file")


def _order_slice_nodes(start_id, included_nodes, incoming, outgoing, lookup):
    ordered = []
    seen = set()

    def add(node_id):
        if node_id in included_nodes and node_id not in seen:
            seen.add(node_id)
            ordered.append(node_id)

    for edge in sorted(incoming.get(start_id, []), key=lambda item: _edge_sort_key(item, lookup)):
        add(edge["from"])

    queue = [start_id]
    add(start_id)
    while queue:
        current = queue.pop(0)
        for edge in sorted(outgoing.get(current, []), key=lambda item: _edge_sort_key(item, lookup)):
            target = edge["to"]
            if target in included_nodes and target not in seen:
                add(target)
                queue.append(target)

    for node_id in sorted(included_nodes, key=lambda item: _label_for(lookup, item)):
        add(node_id)

    return ordered


def _slice_from_ids(graph, node_ids, summary):
    wanted = [node_id for node_id in node_ids if node_id]
    wanted_set = set(wanted)
    edges = [
        edge
        for edge in graph.get("edges", [])
        if edge.get("from") in wanted_set and edge.get("to") in wanted_set
    ]
    return _graph_subset(graph, wanted, edges, summary)


def _graph_subset(graph, node_ids, edges, summary):
    lookup = _node_lookup(graph)
    nodes = [lookup[node_id] for node_id in node_ids if node_id in lookup]

    return {
        **graph,
        "metadata": {
            **graph.get("metadata", {}),
            "summary": summary,
            "trace_slice": True,
        },
        "nodes": nodes,
        "edges": edges,
    }


def _label_for(lookup, node_id):
    node = lookup.get(node_id, {})
    return node.get("label", node_id)


def _best_context_parent(candidates, lookup):
    priority = {
        "file": 0,
        "code": 0,
        "api": 1,
        "handler": 2,
        "function": 3,
        "class": 3,
        "service": 4,
        "import": 5,
    }

    return sorted(
        candidates,
        key=lambda candidate: (
            priority.get(lookup[candidate].get("type", "unknown"), 9),
            lookup[candidate].get("label", candidate),
        ),
    )[0]


def build_execution_path(graph, event, target_id=None):
    lookup = _node_lookup(graph)
    event_text = str(event or "").lower().strip()

    if all(node_id in lookup for node_id in DEMO_PATH) and event_text in {
        "",
        "login",
        "loginbutton",
        "login button",
        "user logs in",
        "user login",
    }:
        return _decorate_path(DEMO_PATH, lookup)

    start = _find_start_node(graph, event_text, target_id)

    if not start:
        if event_text:
            return []

        start = _default_start_node(graph)

    if not start:
        return []

    path = _bfs_path(graph, start["id"])
    if len(path) == 1:
        path = _incoming_context_path(graph, start["id"], lookup)

    return _decorate_path(path, lookup)
