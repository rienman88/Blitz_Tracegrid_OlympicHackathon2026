from ai.featherless import call_llm

def security_agent(graph, use_llm=False):
    nodes = graph.get("nodes", [])
    findings = _findings_for(nodes)

    fallback = {
        "role": "Security Agent",
        "verdict": _verdict_for(findings),
        "grounding": f"Derived from visible graph risk tags: {_risk_summary(nodes)}.",
        "confidence": 0.88,
        "llm_status": "local_graph_reasoning",
        "findings": findings,
    }

    if not use_llm:
        return fallback

    return call_llm(f"""
Analyze security risks in this system graph:

{graph}

Detect:
- auth issues
- API exposure
- unsafe flows
""", fallback=fallback)


def _recommendation_for(node):
    node_type = (node.get("type") or "").lower()
    layer = (node.get("layer") or "").lower()
    label = node.get("label", "this node")
    label_lower = label.lower()

    if node_type in {"api", "route", "endpoint"} or "/api/" in label_lower or label_lower.startswith(("get ", "post ", "put ", "delete ")):
        if node.get("risk") == "low":
            return f"Confirm {label} is intentionally public, has safe response data, and emits enough telemetry for replay."
        return f"Add request validation, auth context checks, throttling, and replay telemetry around {label}."
    if node_type == "middleware" or layer == "security":
        return f"Verify the middleware chain enforces rate limits, auth policy, and fail-closed behavior before {label} passes control."
    if node_type in {"db", "database"} or any(token in label_lower for token in ["query", "store", "database", "db"]):
        return f"Confirm parameterized access, least-privilege credentials, and secret-safe logging for {label}."
    if node_type == "service" or any(token in label_lower for token in ["token", "session"]):
        return f"Constrain token/session behavior and add replay-resistant controls around {label}."
    return f"Review {label} as part of the active execution path."


def _findings_for(nodes):
    findings = [
        {
            "severity": node.get("risk"),
            "node_id": node.get("id"),
            "node": node.get("label"),
            "evidence": _evidence_for(node),
            "recommendation": _recommendation_for(node),
        }
        for node in nodes
        if node.get("risk", "none") != "none"
    ]

    if findings:
        return findings

    return [
        {
            "severity": "info",
            "node": "Focused path",
            "evidence": "Every visible node is currently tagged none by the bounded analyzer.",
            "recommendation": "Use this as a demo-safe signal only. Runtime instrumentation, auth context, and data-flow checks are needed before calling the path clean.",
        }
    ]


def _verdict_for(findings):
    severities = {finding.get("severity") for finding in findings}

    if "high" in severities or "medium" in severities:
        return "Attack surface is visible in the selected execution path."
    if "low" in severities:
        return "Only low-risk signals are visible in this focused path; no medium or high risk was tagged by the current analyzer."
    return "No risk-tagged node is visible in this focused path; treat this as bounded analyzer evidence, not proof of safety."


def _risk_summary(nodes):
    counts = {"none": 0, "low": 0, "medium": 0, "high": 0}
    for node in nodes:
        risk = node.get("risk", "none")
        counts[risk] = counts.get(risk, 0) + 1
    return ", ".join(f"{name}={counts.get(name, 0)}" for name in ["none", "low", "medium", "high"])


def _evidence_for(node):
    evidence = node.get("evidence") or {}
    file_name = evidence.get("file")
    line = evidence.get("line")
    detector = evidence.get("detector")
    risk_reason = _risk_reason_for(node)
    description = node.get("description") or "Graph analyzer identified this node in the selected slice."

    if file_name and line:
        return f"{risk_reason} {description} Evidence: {file_name}:{line} via {detector}."

    return f"{risk_reason} {description}"


def _risk_reason_for(node):
    risk = (node.get("risk") or "none").upper()
    node_type = (node.get("type") or "").lower()
    layer = (node.get("layer") or "").lower()
    label = (node.get("label") or "").lower()

    if node_type in {"api", "route", "endpoint"} or "/api/" in label or label.startswith(("get ", "post ", "put ", "delete ")):
        return f"{risk} risk signal: API or network boundary."
    if node_type == "middleware" or layer == "security":
        return f"{risk} risk signal: security policy boundary."
    if node_type in {"db", "database"} or any(token in label for token in ["query", "store", "database", "db"]):
        return f"{risk} risk signal: persistent data boundary."
    if node_type in {"service", "handler"} or any(token in label for token in ["token", "session", "auth"]):
        return f"{risk} risk signal: backend control or identity/session boundary."
    if node_type in {"ui", "event"}:
        return f"{risk} risk signal: user-triggered control-flow boundary."
    return f"{risk} risk signal: static AST-lite graph classification."
