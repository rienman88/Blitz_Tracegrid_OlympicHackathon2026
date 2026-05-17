export type RiskLevel = "none" | "low" | "medium" | "high";

export type TraceNode = {
  id: string;
  label: string;
  type: string;
  layer: string;
  x?: number;
  y?: number;
  description?: string;
  risk?: RiskLevel;
  confidence?: number;
  evidence?: TraceEvidence;
};

export type TraceEdge = {
  from: string;
  to: string;
  label?: string;
  type?: string;
  risk?: RiskLevel;
  confidence?: number;
  evidence?: TraceEvidence;
};

export type TraceEvidence = {
  file: string;
  line: number;
  detector: string;
  confidence: number;
  detail?: string;
};

export type TraceGraph = {
  metadata?: {
    title?: string;
    mode?: string;
    analyzer?: string;
    summary?: string;
    trace_slice?: boolean;
    files_scanned?: number;
    files_skipped?: number;
    warnings?: string[];
  };
  nodes: TraceNode[];
  edges: TraceEdge[];
};

export type ExecutionStep = TraceNode & {
  step: number;
};

export type TimelineStep = {
  index: number;
  node_id: string;
  label: string;
  layer: string;
  risk: RiskLevel;
  phase: string;
  duration_ms: number;
};

type TraceSliceSummary = {
  summary: string;
  primary: string;
  declares: string;
  imports: string;
  branches: string;
};

export type AgentFinding = {
  severity?: string;
  node?: string;
  node_id?: string;
  evidence?: string;
  recommendation?: string;
};

export type AgentOutput = {
  role?: string;
  verdict?: string;
  grounding?: string;
  confidence?: number;
  signals?: string[];
  steps?: Array<Record<string, unknown>>;
  findings?: AgentFinding[];
  narrative?: string;
  path?: string[];
  llm_status?: string;
  llm_provider?: string;
  llm_model?: string;
  llm_output?: string;
};

export type AgentResults = {
  architecture: AgentOutput;
  execution: AgentOutput;
  security: AgentOutput;
  explainer: AgentOutput;
};

export type ExecuteResponse = {
  graph: TraceGraph;
  trace_slice?: TraceGraph;
  execution_path: ExecutionStep[];
  timeline: TimelineStep[];
};

export type VoiceIntent = {
  intent: string;
  query: string;
  event: string;
  source?: string;
  confidence: number;
  actions: string[];
};

export type VoiceStatus = {
  typed_command_available: boolean;
  speechmatics_configured: boolean;
  speechmatics_language: string;
  speechmatics_mode: string;
};

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? "6500");
const REPOSITORY_API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_REPOSITORY_API_TIMEOUT_MS ?? "45000");
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const EMPTY_GRAPH: TraceGraph = {
  metadata: {
    title: "TraceGrid Execution Graph",
    mode: "ready",
    summary: "Ready for repository analysis."
  },
  nodes: [],
  edges: []
};

export const EMPTY_PATH: ExecutionStep[] = [];
export const EMPTY_TIMELINE: TimelineStep[] = [];

export const DEMO_GRAPH: TraceGraph = {
  metadata: {
    title: "TraceGrid Login Execution Graph",
    mode: "demo",
    summary: "Deterministic UI -> API -> security -> database path for the Milan demo."
  },
  nodes: [
    {
      id: "ui-login-button",
      label: "LoginButton",
      type: "ui",
      layer: "UI",
      x: 85,
      y: 130,
      description: "User action that starts the authentication flow.",
      risk: "none"
    },
    {
      id: "event-onclick",
      label: "onClick handler",
      type: "event",
      layer: "UI",
      x: 245,
      y: 130,
      description: "Captures the click and packages credentials for submission.",
      risk: "low"
    },
    {
      id: "api-auth-login",
      label: "POST /api/auth/login",
      type: "api",
      layer: "API",
      x: 430,
      y: 130,
      description: "Public authentication endpoint exposed to the client.",
      risk: "high"
    },
    {
      id: "auth-handler",
      label: "Auth handler",
      type: "handler",
      layer: "Backend",
      x: 605,
      y: 130,
      description: "Validates input and coordinates credential checks.",
      risk: "medium"
    },
    {
      id: "auth-middleware",
      label: "Auth middleware",
      type: "middleware",
      layer: "Security",
      x: 775,
      y: 130,
      description: "Security boundary where rate limits and policy checks should execute.",
      risk: "high"
    },
    {
      id: "user-db-query",
      label: "User DB query",
      type: "db",
      layer: "Database",
      x: 925,
      y: 130,
      description: "Reads identity records used for login decisions.",
      risk: "high"
    },
    {
      id: "token-service",
      label: "Token service",
      type: "service",
      layer: "Backend",
      x: 775,
      y: 330,
      description: "Creates the authenticated session token after credential validation.",
      risk: "medium"
    },
    {
      id: "session-store",
      label: "Session store",
      type: "db",
      layer: "Database",
      x: 925,
      y: 330,
      description: "Persists the login session for future requests.",
      risk: "medium"
    }
  ],
  edges: [
    { from: "ui-login-button", to: "event-onclick", label: "click", type: "causal" },
    { from: "event-onclick", to: "api-auth-login", label: "fetch", type: "network" },
    { from: "api-auth-login", to: "auth-handler", label: "route", type: "api" },
    { from: "auth-handler", to: "auth-middleware", label: "policy", type: "security", risk: "high" },
    { from: "auth-middleware", to: "user-db-query", label: "lookup", type: "data", risk: "high" },
    { from: "user-db-query", to: "token-service", label: "identity", type: "service" },
    { from: "token-service", to: "session-store", label: "session", type: "data", risk: "medium" }
  ]
};

export const DEMO_PATH: ExecutionStep[] = DEMO_GRAPH.nodes.map((node, index) => ({
  ...node,
  step: index + 1
}));

export const DEMO_TIMELINE: TimelineStep[] = DEMO_PATH.map((node, index) => ({
  index,
  node_id: node.id,
  label: node.label,
  layer: node.layer,
  risk: node.risk ?? "none",
  phase: phaseFor(node.type),
  duration_ms: 650
}));

export function edgeId(edge: TraceEdge) {
  return `${edge.from}-${edge.to}`;
}

export function buildFallbackAgents(graph: TraceGraph, path: ExecutionStep[]): AgentResults {
  const analysisNodes = path.length ? path : graph.nodes;
  const findings = securityFindings(analysisNodes);
  const activePath = path.map((step) => step.label);
  const pathSummary = activePath.length ? activePath.join(" -> ") : "No focused trace selected";
  const traceSignals = traceSliceSignals(graph, path);
  const executionVerdict = activePath.length
    ? "The selected target resolves to a trace slice with a replayable primary path."
    : "The full graph is loaded; choose a Trace Target to isolate a runtime-causal slice.";
  const narrative = buildExecutionNarrative(graph, path);
  const securitySummary = riskSummary(analysisNodes);

  return {
    architecture: {
      role: "Architecture Agent",
      verdict: "The system is reconstructed as a causal graph across UI, API, security, backend, and data layers.",
      grounding: "Derived from graph nodes, edges, and the selected trace slice.",
      confidence: 0.91,
      signals: [
        `${graph.nodes.length} nodes and ${graph.edges.length} causal edges discovered.`,
        `Active path: ${pathSummary}`,
        ...traceSignals
      ]
    },
    execution: {
      role: "Execution Agent",
      verdict: executionVerdict,
      grounding: "Derived from the selected trace slice, branch list, and primary replay path.",
      confidence: 0.93,
      signals: traceSignals,
      steps: path.map((step) => ({
        step: step.step,
        node_id: step.id,
        label: step.label,
        layer: step.layer,
        effect: step.description
      }))
    },
    security: {
      role: "Security Agent",
      verdict: securityVerdict(findings),
      grounding: `Derived from visible graph risk tags: ${securitySummary}.`,
      confidence: 0.88,
      findings
    },
    explainer: {
      role: "Explainer Agent",
      verdict: activePath.length ? "The selected trace becomes a visible story of computation." : "Trace Target converts the full map into an execution story.",
      grounding: "Narrative generated from the active trace slice and replay path.",
      confidence: 0.9,
      narrative,
      signals: path.length ? [...traceSignals, ...pathSignals(graph, path)] : traceSignals,
      path: activePath
    }
  };
}

export async function analyzeRepository(repo = "__demo__"): Promise<TraceGraph> {
  const normalizedRepo = normalizedRepoInput(repo);
  const graph = await postJson<TraceGraph>("/analyze", { repo: normalizedRepo }, DEMO_GRAPH, {
    allowFallback: isDemoRepo(normalizedRepo),
    timeoutMs: REPOSITORY_API_TIMEOUT_MS
  });

  if (!isDemoRepo(normalizedRepo) && isDemoFallbackGraph(graph)) {
    throw new Error(graph.metadata?.warnings?.[0] ?? "Repository analysis returned the demo fallback instead of real repository data.");
  }

  return graph;
}

export async function executeTrace(repo = "__demo__", event = "LoginButton", targetId?: string): Promise<ExecuteResponse> {
  const normalizedRepo = normalizedRepoInput(repo);
  const result = await postJson<ExecuteResponse>(
    "/execute",
    { repo: normalizedRepo, event, target_id: targetId },
    {
      graph: DEMO_GRAPH,
      trace_slice: DEMO_GRAPH,
      execution_path: DEMO_PATH,
      timeline: DEMO_TIMELINE
    },
    {
      allowFallback: isDemoRepo(normalizedRepo),
      timeoutMs: REPOSITORY_API_TIMEOUT_MS
    }
  );

  if (!isDemoRepo(normalizedRepo) && isDemoFallbackGraph(result.graph)) {
    throw new Error(result.graph.metadata?.warnings?.[0] ?? "Trace execution returned the demo fallback instead of real repository data.");
  }

  return result;
}

export async function runAgents(graph: TraceGraph, executionPath: ExecutionStep[]): Promise<AgentResults> {
  return postJson<AgentResults>(
    "/agents",
    {
      graph,
      execution_path: executionPath
    },
    buildFallbackAgents(graph, executionPath)
  );
}

export async function parseVoice(text: string): Promise<VoiceIntent> {
  return postJson<VoiceIntent>(
    "/voice",
    { text },
    {
      intent: "execute_trace",
      query: text,
      event: "LoginButton",
      source: "typed_command",
      confidence: 0.94,
      actions: ["parse_intent", "select_execution_path", "start_replay"]
    }
  );
}

export async function getVoiceStatus(): Promise<VoiceStatus> {
  try {
    const response = await fetchWithTimeout(apiUrl("/voice/status"), {}, 3000);

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    return (await response.json()) as VoiceStatus;
  } catch {
    return {
      typed_command_available: true,
      speechmatics_configured: false,
      speechmatics_language: "en",
      speechmatics_mode: "typed_only"
    };
  }
}

export function speechmaticsRealtimeUrl(sampleRate: number, language = "en") {
  const configuredBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
  let base = configuredBase ?? "ws://localhost:8000";

  if (configuredBase === "" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    base = `${protocol}//${window.location.host}`;
  }

  const params = new URLSearchParams({
    sample_rate: String(sampleRate),
    language
  });

  return `${base}/speechmatics/ws?${params.toString()}`;
}

async function postJson<T>(
  path: string,
  body: unknown,
  fallback: T,
  options: { allowFallback?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  try {
    const response = await fetchWithTimeout(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, options.timeoutMs);

    if (!response.ok) {
      throw new Error(await apiErrorMessage(response));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (!options.allowFallback) {
      throw error;
    }

    return fallback;
  }
}

function normalizedRepoInput(repo: string) {
  return repo.trim() || "__demo__";
}

function isDemoRepo(repo: string) {
  return !repo || repo === "__demo__";
}

function isDemoFallbackGraph(graph: TraceGraph) {
  return graph.metadata?.mode === "demo" || graph.metadata?.analyzer === "demo-fallback";
}

async function apiErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch {
    return `API ${response.status}`;
  }

  return `API ${response.status}`;
}

function apiUrl(path: string) {
  return `${browserAwareApiBaseUrl()}${path}`;
}

function browserAwareApiBaseUrl() {
  if (!RAW_API_BASE_URL) {
    return "";
  }

  if (typeof window === "undefined") {
    return RAW_API_BASE_URL;
  }

  try {
    const apiUrl = new URL(RAW_API_BASE_URL, window.location.origin);
    const appHost = window.location.hostname;

    if (LOCAL_BROWSER_HOSTS.has(apiUrl.hostname) && !LOCAL_BROWSER_HOSTS.has(appHost)) {
      return "";
    }
  } catch {
    return RAW_API_BASE_URL;
  }

  return RAW_API_BASE_URL;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function phaseFor(type: string) {
  const copy: Record<string, string> = {
    ui: "User intent enters the interface.",
    event: "The click is converted into executable control flow.",
    api: "The browser crosses the network boundary.",
    handler: "Backend logic receives and validates the request.",
    middleware: "Security policy should be enforced here.",
    db: "The flow touches persistent identity or session data.",
    service: "Backend service logic produces the runtime outcome."
  };

  return copy[type] ?? "Execution advances through the graph.";
}

function riskSummary(nodes: Array<TraceNode | ExecutionStep>) {
  const counts = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0
  };

  for (const node of nodes) {
    counts[node.risk ?? "none"] += 1;
  }

  return `none=${counts.none}, low=${counts.low}, medium=${counts.medium}, high=${counts.high}`;
}

function securityVerdict(findings: AgentFinding[]) {
  const severities = new Set(findings.map((finding) => finding.severity));

  if (severities.has("high") || severities.has("medium")) {
    return "Attack surface is visible in the selected trace slice.";
  }

  if (severities.has("low")) {
    return "Only low-risk signals are visible in this focused path; no medium or high risk was tagged by the current analyzer.";
  }

  return "No risk-tagged node is visible in this focused path; treat this as bounded analyzer evidence, not proof of safety.";
}

function securityFindings(nodes: Array<TraceNode | ExecutionStep>): AgentFinding[] {
  const visibleFindings = nodes
    .filter((node) => (node.risk ?? "none") !== "none")
    .map((node) => ({
      severity: node.risk,
      node: node.label,
      node_id: node.id,
      evidence: node.description,
      recommendation: recommendationFor(node)
    }));

  if (visibleFindings.length) {
    return visibleFindings;
  }

  return [
    {
      severity: "info",
      node: "Focused path",
      evidence: "Every visible node is currently tagged none by the bounded analyzer.",
      recommendation: "Use this as a demo-safe signal only. Runtime instrumentation, auth context, and data-flow checks are needed before calling the path clean."
    }
  ];
}

function buildExecutionNarrative(graph: TraceGraph, path: ExecutionStep[]) {
  if (!path.length) {
    return "Analyze Repository gives the full system map. Trace Target turns one selected node into a focused trace slice by showing incoming context, outgoing branches, and bounded downstream continuation.";
  }

  const traceSummary = traceSliceSummary(graph, path);
  const details = path.map((step, index) => {
    const next = path[index + 1];
    const edge = next ? graph.edges.find((candidate) => candidate.from === step.id && candidate.to === next.id) : undefined;
    const evidence = evidenceLabel(step);
    const nextCopy = next ? ` It then ${edge?.label ? `${edge.label} ` : "passes control "}to ${next.label}.` : " No further downstream step was discovered from this target.";
    return `Step ${index + 1}: ${step.label} is a ${step.layer} ${step.type} node with ${step.risk ?? "none"} risk. ${step.description ?? phaseFor(step.type)}${evidence}${nextCopy}`;
  });

  return `${traceSummary.summary} ${traceSummary.primary} Branch List: declares: ${traceSummary.declares}; imports: ${traceSummary.imports}; calls/continues: ${traceSummary.branches}. ${details.join(" ")} Focused traces are intentionally smaller than the full repository graph: the canvas shows the selected target's branch context, while replay selects one primary path for animation. If the selected target is terminal, TraceGrid includes the nearest upstream source context so the node remains explainable instead of detached.`;
}

function pathSignals(graph: TraceGraph, path: ExecutionStep[]) {
  const signals = [`Primary replay path length: ${path.length} node${path.length === 1 ? "" : "s"}.`];

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const edge = graph.edges.find((candidate) => candidate.from === from.id && candidate.to === to.id);
    signals.push(`${from.label} ${edge?.label ? `--${edge.label}-->` : "->"} ${to.label}`);
  }

  if (path.length === 1) {
    signals.push("No downstream edge was discovered from this selected target.");
  }

  return signals;
}

function traceSliceSignals(graph: TraceGraph, path: ExecutionStep[]) {
  const summary = traceSliceSummary(graph, path);

  return [
    summary.summary,
    summary.primary,
    `Branch List - declares: ${summary.declares}`,
    `Branch List - imports: ${summary.imports}`,
    `Branch List - calls/continues: ${summary.branches}`
  ];
}

function traceSliceSummary(graph: TraceGraph, path: ExecutionStep[]): TraceSliceSummary {
  const lookup = nodeLookup(graph);
  const selected = path[0] ?? graph.nodes[0];
  const subject = selected && isFileNode(selected) ? "This file" : "This focused trace slice";
  const declarations = selected ? relationshipTargets(graph, lookup, selected.id, "declares") : [];
  const imports = selected ? relationshipTargets(graph, lookup, selected.id, "imports") : [];
  const branches = branchEdges(graph, lookup).map((edge) => edgePair(edge, lookup));

  return {
    summary: `Trace Slice Summary: ${subject} declares ${declarations.length} functions/classes, imports ${imports.length} dependencies, and connects to ${branches.length} local execution branches.`,
    primary: `Primary Replay Path: The current replay path selected for animation is ${pathLabel(path)}.`,
    declares: formatList(declarations),
    imports: formatList(imports),
    branches: formatList(branches)
  };
}

function nodeLookup(graph: TraceGraph) {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function isFileNode(node: TraceNode | ExecutionStep) {
  return node.type === "file" || node.type === "code" || node.layer === "Code";
}

function relationshipTargets(graph: TraceGraph, lookup: Map<string, TraceNode>, selectedId: string, label: string) {
  const seen = new Set<string>();
  const targets: string[] = [];

  for (const edge of graph.edges) {
    if (edge.from !== selectedId || edge.label !== label) {
      continue;
    }

    const target = lookup.get(edge.to);
    const labelText = target?.label ?? edge.to;
    if (!seen.has(labelText)) {
      seen.add(labelText);
      targets.push(labelText);
    }
  }

  return targets;
}

function branchEdges(graph: TraceGraph, lookup: Map<string, TraceNode>) {
  const structuralLabels = new Set(["declares", "imports"]);
  const seen = new Set<string>();
  const edges: TraceEdge[] = [];

  for (const edge of graph.edges) {
    const label = edge.label?.toLowerCase() ?? "";
    if (structuralLabels.has(label) || !lookup.has(edge.from) || !lookup.has(edge.to)) {
      continue;
    }

    const key = `${edge.from}->${edge.to}:${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  }

  return edges;
}

function edgePair(edge: TraceEdge, lookup: Map<string, TraceNode>) {
  const from = lookup.get(edge.from)?.label ?? edge.from;
  const to = lookup.get(edge.to)?.label ?? edge.to;
  const connector = edge.label ? `--${edge.label}-->` : "->";
  return `${from} ${connector} ${to}`;
}

function pathLabel(path: ExecutionStep[]) {
  return path.length ? path.map((node) => node.label).join(" -> ") : "no replay path selected";
}

function formatList(items: string[], limit = 8) {
  if (!items.length) {
    return "none detected in this slice";
  }

  const visible = items.slice(0, limit).join(", ");
  const remaining = items.length - limit;
  return remaining > 0 ? `${visible}, +${remaining} more` : visible;
}

function evidenceLabel(node: TraceNode | ExecutionStep) {
  if (!node.evidence) {
    return "";
  }

  return ` Evidence: ${node.evidence.file}:${node.evidence.line} via ${node.evidence.detector}.`;
}

function recommendationFor(node: TraceNode) {
  if (node.type === "api") {
    if (node.risk === "low") {
      return `Confirm ${node.label} is intentionally public, has safe response data, and emits enough telemetry for replay.`;
    }

    return `Add explicit validation, throttling, and telemetry around ${node.label}.`;
  }

  if (node.type === "middleware") {
    return `Verify rate limits, auth policy, and fail-closed behavior before ${node.label} passes control.`;
  }

  if (node.type === "db") {
    return `Confirm parameterized queries, secret-safe logging, and least-privilege access for ${node.label}.`;
  }

  if (node.type === "service") {
    return `Constrain token/session behavior and add replay-resistant controls around ${node.label}.`;
  }

  return `Review ${node.label} as part of the active trace slice.`;
}
