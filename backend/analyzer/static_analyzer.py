import ast
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import requests

SKIP_DIRS = {
    ".git",
    ".next",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "venv",
    ".venv",
}

SUPPORTED_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".py"}
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options"}
MAX_FILES = 650
MAX_BYTES_PER_FILE = 450_000
PROJECT_ROOT = Path(__file__).resolve().parents[2]
GITHUB_REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")


class RepositoryAnalysisError(Exception):
    pass


def _stable_id(prefix, value):
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"


def _evidence(rel_path, line, detector, confidence, detail=None):
    data = {
        "file": rel_path,
        "line": line,
        "detector": detector,
        "confidence": confidence,
    }
    if detail:
        data["detail"] = detail
    return data


def _add_node(nodes, node_index, *, prefix, label, node_type, layer, rel_path, line, detector,
              confidence, description, risk="none", identity=None, x=None, y=None):
    node_id = _stable_id(prefix, identity or f"{rel_path}:{line}:{label}:{detector}")
    if node_id in node_index:
        return node_id

    node = {
        "id": node_id,
        "label": label,
        "type": node_type,
        "layer": layer,
        "description": description,
        "risk": risk,
        "confidence": confidence,
        "evidence": _evidence(rel_path, line, detector, confidence),
    }
    if x is not None:
        node["x"] = x
    if y is not None:
        node["y"] = y

    node_index[node_id] = node
    nodes.append(node)
    return node_id


def _add_edge(edges, edge_index, source, target, *, label, edge_type, rel_path, line,
              detector, confidence, risk=None):
    edge_id = (source, target, label, edge_type)
    if edge_id in edge_index:
        return

    edge = {
        "from": source,
        "to": target,
        "label": label,
        "type": edge_type,
        "confidence": confidence,
        "evidence": _evidence(rel_path, line, detector, confidence),
    }
    if risk:
        edge["risk"] = risk

    edge_index.add(edge_id)
    edges.append(edge)


def build_demo_graph():
    nodes = [
        {
            "id": "ui-login-button",
            "label": "LoginButton",
            "type": "ui",
            "layer": "UI",
            "x": 85,
            "y": 130,
            "description": "User action that starts the authentication flow.",
            "risk": "none",
        },
        {
            "id": "event-onclick",
            "label": "onClick handler",
            "type": "event",
            "layer": "UI",
            "x": 245,
            "y": 130,
            "description": "Captures the click and packages credentials for submission.",
            "risk": "low",
        },
        {
            "id": "api-auth-login",
            "label": "POST /api/auth/login",
            "type": "api",
            "layer": "API",
            "x": 430,
            "y": 130,
            "description": "Public authentication endpoint exposed to the client.",
            "risk": "high",
        },
        {
            "id": "auth-handler",
            "label": "Auth handler",
            "type": "handler",
            "layer": "Backend",
            "x": 605,
            "y": 130,
            "description": "Validates input and coordinates credential checks.",
            "risk": "medium",
        },
        {
            "id": "auth-middleware",
            "label": "Auth middleware",
            "type": "middleware",
            "layer": "Security",
            "x": 775,
            "y": 130,
            "description": "Security boundary where rate limits and policy checks should execute.",
            "risk": "high",
        },
        {
            "id": "user-db-query",
            "label": "User DB query",
            "type": "db",
            "layer": "Database",
            "x": 925,
            "y": 130,
            "description": "Reads identity records used for login decisions.",
            "risk": "high",
        },
        {
            "id": "token-service",
            "label": "Token service",
            "type": "service",
            "layer": "Backend",
            "x": 775,
            "y": 330,
            "description": "Creates the authenticated session token after credential validation.",
            "risk": "medium",
        },
        {
            "id": "session-store",
            "label": "Session store",
            "type": "db",
            "layer": "Database",
            "x": 925,
            "y": 330,
            "description": "Persists the login session for future requests.",
            "risk": "medium",
        },
    ]

    edges = [
        {"from": "ui-login-button", "to": "event-onclick", "label": "click", "type": "causal"},
        {"from": "event-onclick", "to": "api-auth-login", "label": "fetch", "type": "network"},
        {"from": "api-auth-login", "to": "auth-handler", "label": "route", "type": "api"},
        {"from": "auth-handler", "to": "auth-middleware", "label": "policy", "type": "security", "risk": "high"},
        {"from": "auth-middleware", "to": "user-db-query", "label": "lookup", "type": "data", "risk": "high"},
        {"from": "user-db-query", "to": "token-service", "label": "identity", "type": "service"},
        {"from": "token-service", "to": "session-store", "label": "session", "type": "data", "risk": "medium"},
    ]

    for index, node in enumerate(nodes, start=1):
        node["confidence"] = 0.99
        node["evidence"] = _evidence(
            "demo://tracegrid/login-flow",
            index,
            "demo.fixture",
            0.99,
            "Controlled demo fallback for the Milan judging sequence.",
        )

    for index, edge in enumerate(edges, start=1):
        edge["confidence"] = 0.99
        edge["evidence"] = _evidence(
            "demo://tracegrid/login-flow",
            index,
            "demo.fixture",
            0.99,
            "Controlled demo causal path.",
        )

    return {
        "metadata": {
            "title": "TraceGrid Login Execution Graph",
            "mode": "demo",
            "analyzer": "demo-fallback",
            "summary": "Deterministic UI -> API -> security -> database path for the Milan demo.",
        },
        "nodes": nodes,
        "edges": edges,
    }


def analyze_repo(path):
    if not path or path == "__demo__":
        return build_demo_graph()

    if _looks_like_github_url(path):
        return _analyze_github_repo(path)

    if not os.path.isdir(path):
        raise RepositoryAnalysisError(f"Repository path was not accessible to the backend: {path}")

    return _analyze_local_repo(path, source_label=path)


def _analyze_github_repo(url):
    if os.getenv("ALLOW_GITHUB_INGESTION", "true").lower() not in {"1", "true", "yes"}:
        raise RepositoryAnalysisError("GitHub ingestion is disabled by ALLOW_GITHUB_INGESTION.")

    parsed = _parse_github_url(url)
    if not parsed:
        raise RepositoryAnalysisError("Only public https://github.com/{owner}/{repo} URLs are accepted.")

    owner, repo, source_label = parsed
    timeout = _safe_int(os.getenv("GITHUB_CLONE_TIMEOUT_SECONDS"), 25)
    archive_url = _github_archive_url(owner, repo, timeout)

    with tempfile.TemporaryDirectory(prefix="tracegrid-github-") as workspace:
        try:
            response = requests.get(
                archive_url,
                timeout=(4, timeout),
                headers={"User-Agent": "TraceGrid-AST-Lite"},
            )
            response.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                archive.extractall(workspace)
        except requests.RequestException as exc:
            raise RepositoryAnalysisError(f"GitHub archive download failed for {source_label}: {exc.__class__.__name__}") from exc
        except (zipfile.BadZipFile, OSError) as exc:
            raise RepositoryAnalysisError(f"GitHub archive extraction failed for {source_label}: {exc.__class__.__name__}") from exc

        extracted = [path for path in Path(workspace).iterdir() if path.is_dir()]
        if not extracted:
            raise RepositoryAnalysisError(f"GitHub archive contained no repository directory: {source_label}")

        graph = _analyze_local_repo(str(extracted[0]), source_label=source_label)
        graph["metadata"]["mode"] = "github-ast-lite"
        graph["metadata"]["source_repo"] = source_label
        graph["metadata"]["summary"] = f"Evidence-backed structural reconstruction from public GitHub repo {source_label}."
        graph["metadata"].setdefault("warnings", [])
        graph["metadata"]["warnings"] = [
            "Public GitHub repo archive was downloaded into a temporary backend directory and deleted after analysis.",
            *graph["metadata"]["warnings"],
        ][:12]
        return graph


def _analyze_local_repo(path, source_label):
    nodes = []
    edges = []
    node_index = {}
    edge_index = set()
    warnings = []
    files_scanned = 0
    files_skipped = 0

    for full_path in _iter_source_files(path):
        if files_scanned >= MAX_FILES:
            warnings.append(f"Stopped after {MAX_FILES} files to keep analysis bounded for demo safety.")
            break

        rel_path = os.path.relpath(full_path, path)
        file_size = os.path.getsize(full_path)
        if file_size > MAX_BYTES_PER_FILE:
            files_skipped += 1
            warnings.append(f"Skipped oversized file: {rel_path}")
            continue

        files_scanned += 1
        file_id = _add_node(
            nodes,
            node_index,
            prefix="file",
            label=rel_path,
            node_type="file",
            layer="Code",
            rel_path=rel_path,
            line=1,
            detector="repo.walk",
            confidence=0.99,
            description="Source file discovered by bounded repository ingestion.",
            identity=rel_path,
        )

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as code:
                content = code.read()
        except OSError as exc:
            warnings.append(f"Could not read {rel_path}: {exc.__class__.__name__}")
            continue

        suffix = Path(full_path).suffix.lower()
        if suffix == ".py":
            _analyze_python_file(content, rel_path, file_id, nodes, node_index, edges, edge_index, warnings)
        else:
            _analyze_js_ts_file(path, rel_path, content, file_id, nodes, node_index, edges, edge_index, warnings)

    return {
        "metadata": {
            "title": "TraceGrid AST-Lite Analysis Graph",
            "mode": "ast-lite",
            "analyzer": "python-ast + ts-ast-lite",
            "summary": f"Evidence-backed structural reconstruction from {source_label}.",
            "source_repo": source_label,
            "files_scanned": files_scanned,
            "files_skipped": files_skipped,
            "warnings": warnings[:12],
        },
        "nodes": nodes,
        "edges": edges,
    }


def _looks_like_github_url(value):
    parsed = urlparse(str(value).strip())
    return parsed.scheme in {"http", "https"} and parsed.netloc.lower() in {"github.com", "www.github.com"}


def _parse_github_url(value):
    parsed = urlparse(str(value).strip())
    if parsed.scheme != "https" or parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return None

    owner = parts[0]
    repo = parts[1].removesuffix(".git")
    if not GITHUB_REPO_PATTERN.match(owner) or not GITHUB_REPO_PATTERN.match(repo):
        return None

    source_label = f"github.com/{owner}/{repo}"
    return owner, repo, source_label


def _github_archive_url(owner, repo, timeout):
    branch = "main"
    try:
        response = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            timeout=(3, min(timeout, 8)),
            headers={"User-Agent": "TraceGrid-AST-Lite"},
        )
        if response.ok:
            branch = response.json().get("default_branch") or branch
    except requests.RequestException:
        pass

    return f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"


def _safe_int(value, default):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _iter_source_files(path):
    for root, dirs, files in os.walk(path):
        dirs[:] = [directory for directory in dirs if directory not in SKIP_DIRS]
        for filename in sorted(files):
            if Path(filename).suffix.lower() in SUPPORTED_EXTENSIONS:
                yield os.path.join(root, filename)


def _analyze_python_file(content, rel_path, file_id, nodes, node_index, edges, edge_index, warnings):
    try:
        tree = ast.parse(content)
    except SyntaxError as exc:
        warnings.append(f"Python AST parse failed for {rel_path}:{exc.lineno}; using regex fallback.")
        _regex_fallback_scan(content, rel_path, file_id, nodes, node_index, edges, edge_index, "python.regex-fallback")
        return

    import_count = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)) and import_count < 24:
            import_count += 1
            label = _python_import_label(node)
            import_id = _add_node(
                nodes,
                node_index,
                prefix="import",
                label=label,
                node_type="import",
                layer="Dependency",
                rel_path=rel_path,
                line=getattr(node, "lineno", 1),
                detector="python.ast.Import",
                confidence=0.94,
                description=f"Python import dependency detected: {label}.",
                risk="none",
            )
            _add_edge(
                edges,
                edge_index,
                file_id,
                import_id,
                label="imports",
                edge_type="dependency",
                rel_path=rel_path,
                line=getattr(node, "lineno", 1),
                detector="python.ast.Import",
                confidence=0.94,
            )

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            _analyze_python_function(node, rel_path, file_id, nodes, node_index, edges, edge_index)
        elif isinstance(node, ast.ClassDef):
            class_id = _add_node(
                nodes,
                node_index,
                prefix="class",
                label=node.name,
                node_type="class",
                layer="Backend",
                rel_path=rel_path,
                line=node.lineno,
                detector="python.ast.ClassDef",
                confidence=0.95,
                description=f"Python class definition detected: {node.name}.",
                risk=_risk_from_label(node.name),
            )
            _add_edge(
                edges,
                edge_index,
                file_id,
                class_id,
                label="declares",
                edge_type="structural",
                rel_path=rel_path,
                line=node.lineno,
                detector="python.ast.ClassDef",
                confidence=0.95,
            )


def _analyze_python_function(node, rel_path, file_id, nodes, node_index, edges, edge_index):
    function_risk = _risk_from_label(node.name)
    function_id = _add_node(
        nodes,
        node_index,
        prefix="fn",
        label=node.name,
        node_type="handler" if _route_decorators(node) else "function",
        layer="Backend",
        rel_path=rel_path,
        line=node.lineno,
        detector="python.ast.FunctionDef",
        confidence=0.96,
        description=f"Python function detected: {node.name}.",
        risk=function_risk,
    )
    _add_edge(
        edges,
        edge_index,
        file_id,
        function_id,
        label="declares",
        edge_type="structural",
        rel_path=rel_path,
        line=node.lineno,
        detector="python.ast.FunctionDef",
        confidence=0.96,
        risk=function_risk if function_risk != "none" else None,
    )

    for route in _route_decorators(node):
        route_id = _add_node(
            nodes,
            node_index,
            prefix="route",
            label=f"{route['method']} {route['path']}",
            node_type="api",
            layer="API",
            rel_path=rel_path,
            line=route["line"],
            detector="python.ast.FastAPIRoute",
            confidence=0.97,
            description=f"FastAPI-style route decorator bound to {node.name}.",
            risk="medium" if route["method"] in {"POST", "PUT", "PATCH", "DELETE"} else "low",
        )
        _add_edge(
            edges,
            edge_index,
            file_id,
            route_id,
            label="declares",
            edge_type="api",
            rel_path=rel_path,
            line=route["line"],
            detector="python.ast.FastAPIRoute",
            confidence=0.97,
        )
        _add_edge(
            edges,
            edge_index,
            route_id,
            function_id,
            label="handles",
            edge_type="causal",
            rel_path=rel_path,
            line=route["line"],
            detector="python.ast.FastAPIRoute",
            confidence=0.9,
        )

    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        call_name = _call_name(child.func)
        if not call_name:
            continue
        line = getattr(child, "lineno", node.lineno)
        _add_call_signal(call_name, rel_path, line, function_id, nodes, node_index, edges, edge_index, "python.ast.Call")


def _python_import_label(node):
    if isinstance(node, ast.ImportFrom):
        module = node.module or "."
        return f"from {module}"
    return ", ".join(alias.name for alias in node.names[:3])


def _route_decorators(node):
    routes = []
    for decorator in node.decorator_list:
        if not isinstance(decorator, ast.Call):
            continue
        func = decorator.func
        if not isinstance(func, ast.Attribute) or func.attr.lower() not in HTTP_METHODS:
            continue
        if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
            continue
        route_path = decorator.args[0].value
        if not isinstance(route_path, str):
            continue
        routes.append({
            "method": func.attr.upper(),
            "path": route_path,
            "line": getattr(decorator, "lineno", node.lineno),
        })
    return routes


def _call_name(func):
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        parent = _call_name(func.value)
        return f"{parent}.{func.attr}" if parent else func.attr
    return None


def _analyze_js_ts_file(repo_path, rel_path, content, file_id, nodes, node_index, edges, edge_index, warnings):
    records = _typescript_ast_records(repo_path, rel_path, warnings)
    if not records:
        records = _js_regex_records(content)

    for record in records:
        signal_id = _add_signal_record(record, rel_path, file_id, nodes, node_index)
        _add_edge(
            edges,
            edge_index,
            file_id,
            signal_id,
            label=record.get("edge_label", "declares"),
            edge_type=record.get("edge_type", "structural"),
            rel_path=rel_path,
            line=record.get("line", 1),
            detector=record.get("detector", "ts.regex-fallback"),
            confidence=record.get("confidence", 0.64),
            risk=record.get("risk") if record.get("risk") != "none" else None,
        )


def _typescript_ast_records(repo_path, rel_path, warnings):
    node = shutil.which("node")
    if not node:
        return []

    script = PROJECT_ROOT / "backend" / "analyzer" / "ts_ast_extractor.mjs"
    if not script.exists():
        return []

    env = os.environ.copy()
    module_paths = [
        str(PROJECT_ROOT / "backend" / "node_modules"),
        str(PROJECT_ROOT / "frontend" / "node_modules"),
    ]
    existing = env.get("NODE_PATH")
    env["NODE_PATH"] = os.pathsep.join(module_paths + ([existing] if existing else []))

    try:
        result = subprocess.run(
            [node, str(script), str(repo_path), rel_path],
            capture_output=True,
            text=True,
            timeout=10,
            env=env,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        warnings.append(f"TypeScript AST bridge unavailable for {rel_path}: {exc.__class__.__name__}")
        return []

    if result.returncode != 0:
        if result.stderr:
            warnings.append(f"TypeScript AST bridge fallback for {rel_path}: {result.stderr.strip()[:140]}")
        return []

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        warnings.append(f"TypeScript AST bridge returned invalid JSON for {rel_path}.")
        return []

    return payload.get("records", [])


def _js_regex_records(content):
    records = []
    for line_number, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        import_match = re.match(r"import\s+.*?from\s+['\"]([^'\"]+)['\"]|const\s+\w+\s*=\s*require\(['\"]([^'\"]+)['\"]\)", stripped)
        function_match = re.match(r"(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)", stripped)
        const_function_match = re.match(r"(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?[\(\w]", stripped)
        route_match = re.match(r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\b", stripped)

        if import_match:
            label = import_match.group(1) or import_match.group(2)
            records.append(_signal_record("import", label, "Dependency", line_number, "ts.regex.Import", 0.62, "imports", "dependency"))
        if function_match:
            label = function_match.group(1)
            records.append(_signal_record("function", label, "UI" if _looks_component(label) else "Frontend", line_number, "ts.regex.Function", 0.63))
        if const_function_match:
            label = const_function_match.group(1)
            records.append(_signal_record("function", label, "UI" if _looks_component(label) else "Frontend", line_number, "ts.regex.VariableFunction", 0.58))
        if route_match:
            method = route_match.group(1)
            records.append(_signal_record("api", f"Next route {method}", "API", line_number, "ts.regex.NextRoute", 0.68, "handles", "api", "medium"))
        if "onClick" in stripped or "addEventListener(\"click" in stripped or "addEventListener('click" in stripped:
            records.append(_signal_record("event", "Click event", "UI", line_number, "ts.regex.ClickHandler", 0.7, "declares", "causal", "low"))

        _append_keyword_records(records, stripped, line_number, "ts.regex")

    return records


def _signal_record(node_type, label, layer, line, detector, confidence, edge_label="declares",
                   edge_type="structural", risk="none", description=None):
    return {
        "type": node_type,
        "label": label,
        "layer": layer,
        "line": line,
        "detector": detector,
        "confidence": confidence,
        "edge_label": edge_label,
        "edge_type": edge_type,
        "risk": risk,
        "description": description or _description_for(node_type, label),
    }


def _append_keyword_records(records, line, line_number, detector_prefix):
    if re.search(r"\bfetch\s*\(|axios\.|XMLHttpRequest", line):
        records.append(_signal_record("api", "API call", "API", line_number, f"{detector_prefix}.NetworkCall", 0.72, "calls", "network", "medium"))
    if re.search(r"prisma\.|sequelize\.|mongoose\.|\bsql\b|\.query\s*\(", line, re.I):
        records.append(_signal_record("db", "Database operation", "Database", line_number, f"{detector_prefix}.DatabaseCall", 0.7, "reads/writes", "data", "medium"))
    if re.search(r"auth|token|session|jwt|middleware", line, re.I):
        records.append(_signal_record("middleware", "Auth boundary", "Security", line_number, f"{detector_prefix}.AuthKeyword", 0.62, "guards", "security", "medium"))


def _add_signal_record(record, rel_path, file_id, nodes, node_index):
    node_type = record.get("type", "function")
    prefix = {
        "api": "api",
        "db": "db",
        "event": "event",
        "function": "fn",
        "import": "import",
        "middleware": "auth",
    }.get(node_type, node_type)

    return _add_node(
        nodes,
        node_index,
        prefix=prefix,
        label=record.get("label", node_type),
        node_type=node_type,
        layer=record.get("layer", "Code"),
        rel_path=rel_path,
        line=record.get("line", 1),
        detector=record.get("detector", "ast-lite"),
        confidence=record.get("confidence", 0.6),
        description=record.get("description") or _description_for(node_type, record.get("label", node_type)),
        risk=record.get("risk", "none"),
        identity=f"{rel_path}:{record.get('line', 1)}:{record.get('label', node_type)}:{record.get('detector', 'ast-lite')}",
    )


def _add_call_signal(call_name, rel_path, line, source_id, nodes, node_index, edges, edge_index, detector):
    lowered = call_name.lower()
    if any(token in lowered for token in ["requests.", "httpx.", "urllib.", "fetch", "axios"]):
        node_type, layer, label, edge_label, edge_type, risk, confidence = "api", "API", call_name, "calls", "network", "medium", 0.85
    elif any(token in lowered for token in ["execute", "query", "sql", "prisma", "session.", "db."]):
        node_type, layer, label, edge_label, edge_type, risk, confidence = "db", "Database", call_name, "reads/writes", "data", "medium", 0.78
    elif any(token in lowered for token in ["auth", "token", "session", "jwt", "middleware"]):
        node_type, layer, label, edge_label, edge_type, risk, confidence = "middleware", "Security", call_name, "guards", "security", "medium", 0.74
    else:
        return

    target_id = _add_node(
        nodes,
        node_index,
        prefix=node_type,
        label=label,
        node_type=node_type,
        layer=layer,
        rel_path=rel_path,
        line=line,
        detector=detector,
        confidence=confidence,
        description=_description_for(node_type, label),
        risk=risk,
    )
    _add_edge(
        edges,
        edge_index,
        source_id,
        target_id,
        label=edge_label,
        edge_type=edge_type,
        rel_path=rel_path,
        line=line,
        detector=detector,
        confidence=confidence,
        risk=risk,
    )


def _regex_fallback_scan(content, rel_path, file_id, nodes, node_index, edges, edge_index, detector):
    for record in _js_regex_records(content):
        record["detector"] = detector
        record["confidence"] = min(record.get("confidence", 0.5), 0.55)
        signal_id = _add_signal_record(record, rel_path, file_id, nodes, node_index)
        _add_edge(
            edges,
            edge_index,
            file_id,
            signal_id,
            label=record.get("edge_label", "declares"),
            edge_type=record.get("edge_type", "structural"),
            rel_path=rel_path,
            line=record.get("line", 1),
            detector=record["detector"],
            confidence=record["confidence"],
        )


def _description_for(node_type, label):
    descriptions = {
        "api": f"Network/API boundary detected: {label}.",
        "db": f"Database/data access signal detected: {label}.",
        "event": f"UI event signal detected: {label}.",
        "function": f"Function or component detected: {label}.",
        "import": f"Import dependency detected: {label}.",
        "middleware": f"Authentication/security boundary signal detected: {label}.",
    }
    return descriptions.get(node_type, f"AST-lite signal detected: {label}.")


def _risk_from_label(label):
    return "medium" if re.search(r"auth|token|session|jwt|password|secret|login|middleware", label, re.I) else "none"


def _looks_component(label):
    return bool(label) and label[0].isupper()
