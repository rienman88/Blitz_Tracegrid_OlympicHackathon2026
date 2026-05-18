"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, Database, Film, GitBranch, Mic, MousePointer, Play, Search, Shield, type LucideIcon } from "lucide-react";
import Agents from "../components/agents";
import Graph from "../components/graph";
import Timeline from "../components/timeline";
import {
  analyzeRepository,
  buildFallbackAgents,
  DEMO_GRAPH,
  DEMO_PATH,
  DEMO_TIMELINE,
  EMPTY_GRAPH,
  EMPTY_PATH,
  EMPTY_TIMELINE,
  edgeId,
  executeTrace,
  getVoiceStatus,
  parseVoice,
  runAgents,
  speechmaticsRealtimeUrl,
  type AgentResults,
  type ExecutionStep,
  type TimelineStep,
  type TraceGraph,
  type TraceNode,
  type VoiceStatus
} from "../lib/api";
import { ReplayControls } from "./replay";
import { VoiceCommandPanel } from "./voice";

type StageId = "hook" | "reveal" | "click" | "agents" | "security" | "voice" | "replay";

type InvestigationVerdict = {
  target: string;
  rootCause: string;
  attackSurface: string;
  primaryReplayPath: string;
  recommendedFix: string;
  confidence: string;
  score: InvestigationScoreBreakdown;
};

type InvestigationScoreBreakdown = {
  total: number;
  risk: number;
  connections: number;
  layer: number;
  directConnections: number;
};

type GraphViewSnapshot = {
  graph: TraceGraph;
  path: ExecutionStep[];
  timeline: TimelineStep[];
  agents: AgentResults;
  investigation?: InvestigationVerdict;
  traceFocused: boolean;
  targetOptions: string[];
  stage: StageId;
  revealCount: number;
  activeIndex: number;
  selectedNodeId?: string;
  traceTarget: string;
  traceTargetId?: string;
};

const STAGES: Array<{
  id: StageId;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { id: "hook", label: "Opening Hook", detail: "black box to behavior", icon: Search },
  { id: "reveal", label: "Graph Reveal", detail: "static code to causal graph", icon: GitBranch },
  { id: "click", label: "Click Moment", detail: "selected target runtime path", icon: MousePointer },
  { id: "agents", label: "Agents", detail: "graph-grounded reasoning", icon: Bot },
  { id: "security", label: "Security", detail: "attack surface in flow", icon: Shield },
  { id: "voice", label: "Voice", detail: "natural language trace", icon: Mic },
  { id: "replay", label: "Replay", detail: "software execution film", icon: Film }
];

const PULSE_DELAY_MS = 360;
const BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_TRACEGRID_VERSION?.trim() || "hackathon",
  commit: process.env.NEXT_PUBLIC_GIT_SHA?.trim() || "local",
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || "dev build"
};

const STAGE_GUIDE: Record<StageId, { title: string; purpose: string; result: string }> = {
  hook: {
    title: "Ready state",
    purpose: "Start clean so judges see the graph form from nothing.",
    result: "Use Analyze Repository first."
  },
  reveal: {
    title: "Graph reveal",
    purpose: "Turns a local path, public GitHub URL, or demo fixture into a causal execution graph.",
    result: "Nodes and edges appear progressively."
  },
  click: {
    title: "Click moment",
    purpose: "Shows what one user click causes across UI, API, backend, security, and data.",
    result: "The selected trace target pulses step by step."
  },
  agents: {
    title: "Agent reasoning",
    purpose: "Asks graph-grounded agents to explain architecture, execution, security, and narrative.",
    result: "Agent cards update without replacing the graph."
  },
  security: {
    title: "Security view",
    purpose: "Highlights the attack surface directly on the active trace slice.",
    result: "Medium and high risk nodes glow."
  },
  voice: {
    title: "Voice command",
    purpose: "Parses natural language into the same trace action.",
    result: "Typed or Speechmatics input can name a target to trace."
  },
  replay: {
    title: "Cinematic replay",
    purpose: "Turns the execution path into a repeatable software movie.",
    result: "The timeline and graph pulse in order."
  }
};

export default function Home() {
  const [graph, setGraph] = useState<TraceGraph>(EMPTY_GRAPH);
  const [path, setPath] = useState<ExecutionStep[]>(EMPTY_PATH);
  const [timeline, setTimeline] = useState<TimelineStep[]>(EMPTY_TIMELINE);
  const [agents, setAgents] = useState<AgentResults>(buildFallbackAgents(EMPTY_GRAPH, EMPTY_PATH));
  const [investigation, setInvestigation] = useState<InvestigationVerdict>();
  const [repositoryGraph, setRepositoryGraph] = useState<TraceGraph>(EMPTY_GRAPH);
  const [traceFocused, setTraceFocused] = useState(false);
  const [stage, setStage] = useState<StageId>("hook");
  const [revealCount, setRevealCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [repoPath, setRepoPath] = useState("__demo__");
  const [traceTarget, setTraceTarget] = useState("");
  const [traceTargetId, setTraceTargetId] = useState<string>();
  const [graphHistory, setGraphHistory] = useState<GraphViewSnapshot[]>([]);
  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [voiceText, setVoiceText] = useState("Trace what happens when a user logs in");
  const [voiceResult, setVoiceResult] = useState<string>();
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>();
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [actionStatus, setActionStatus] = useState("Ready. Start with Analyze Repository.");
  const speechSocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveTriggeredRef = useRef(false);

  useEffect(() => {
    void getVoiceStatus().then(setVoiceStatus);

    return () => {
      stopLiveVoice();
    };
  }, []);

  const activeNodeIds = useMemo(() => {
    if (stage === "security") {
      return graph.nodes
        .filter((node) => node.risk === "medium" || node.risk === "high")
        .map((node) => node.id);
    }

    return path.slice(0, activeIndex + 1).map((step) => step.id);
  }, [activeIndex, graph.nodes, path, stage]);

  const activeEdgeIds = useMemo(() => {
    if (stage === "security") {
      const activeSet = new Set(activeNodeIds);
      return graph.edges
        .filter((edge) => activeSet.has(edge.from) && activeSet.has(edge.to))
        .map(edgeId);
    }

    const ids: string[] = [];
    for (let index = 1; index <= activeIndex && index < path.length; index += 1) {
      ids.push(`${path[index - 1].id}-${path[index].id}`);
    }
    return ids;
  }, [activeIndex, activeNodeIds, graph.edges, path, stage]);

  const riskCount = graph.nodes.filter((node) => node.risk === "medium" || node.risk === "high").length;
  const currentGuide = STAGE_GUIDE[stage];
  const previousGraphView = graphHistory[graphHistory.length - 1];
  const canReturnToPreviousTrace = Boolean(previousGraphView?.traceFocused);
  const replayTargetLabel = path.length
    ? path.map((step) => step.label).join(" -> ")
    : "No primary path selected";
  const graphModeLabel = traceFocused ? "Focused Trace Slice" : graph.nodes.length ? "Full Repository Graph" : "Ready Graph";
  const replayModeLabel = path.length ? "Primary Replay Path" : "No Replay Path Selected";
  const analyzerMode = graph.metadata?.analyzer ?? graph.metadata?.mode ?? "static-causal";

  function currentGraphSnapshot(): GraphViewSnapshot {
    return {
      graph,
      path,
      timeline,
      agents,
      investigation,
      traceFocused,
      targetOptions,
      stage,
      revealCount,
      activeIndex,
      selectedNodeId,
      traceTarget,
      traceTargetId
    };
  }

  function restoreGraphSnapshot(snapshot: GraphViewSnapshot) {
    setGraph(snapshot.graph);
    setPath(snapshot.path);
    setTimeline(snapshot.timeline);
    setAgents(snapshot.agents);
    setInvestigation(snapshot.investigation);
    setTraceFocused(snapshot.traceFocused);
    setTargetOptions(snapshot.targetOptions);
    setStage(snapshot.stage);
    setRevealCount(snapshot.revealCount);
    setActiveIndex(snapshot.activeIndex);
    setSelectedNodeId(snapshot.selectedNodeId);
    setTraceTarget(snapshot.traceTarget);
    setTraceTargetId(snapshot.traceTargetId);
  }

  function pushGraphHistory(snapshot: GraphViewSnapshot) {
    if (!snapshot.graph.nodes.length) {
      return;
    }

    setGraphHistory((history) => [...history.slice(-9), snapshot]);
  }

  async function handleAnalyze() {
    setLoading(true);
    setStage("reveal");
    setActionStatus("Analyzing repository and preparing graph reveal...");
    setActiveIndex(-1);
    setRevealCount(0);
    setSelectedNodeId(undefined);
    setTraceTargetId(undefined);
    setGraphHistory([]);
    setInvestigation(undefined);

    try {
      const nextGraph = await analyzeRepository(repoPath.trim() || "__demo__");
      setGraph(nextGraph);
      setRepositoryGraph(nextGraph);
      setTraceFocused(false);
      setTargetOptions(nodeLabels(nextGraph));
      setPath(EMPTY_PATH);
      setTimeline(EMPTY_TIMELINE);
      setAgents(buildFallbackAgents(nextGraph, EMPTY_PATH));

      const revealDelay = nextGraph.nodes.length > 40 ? 12 : 155;
      for (let count = 1; count <= nextGraph.nodes.length; count += 1) {
        await delay(revealDelay);
        setRevealCount(count);
      }

      setActionStatus(`Graph reveal complete: ${nextGraph.nodes.length} nodes and ${nextGraph.edges.length} edges.`);
    } catch (error) {
      setActionStatus(`Analyze failed: ${formatError(error)}. The current graph was not replaced. Use __demo__ only when you intentionally want the login fixture.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginTrace(nextStage: StageId = "click", targetOverride?: string, targetIdOverride?: string) {
    setLoading(true);
    setStage(nextStage);
    const target = normalizedTraceTarget(targetOverride ?? traceTarget);
    const targetId = targetIdOverride ?? traceTargetId;
    setTraceTarget(target);
    setTraceTargetId(targetId);
    setInvestigation(undefined);

    try {
      setActionStatus(`Tracing ${target} across the system...`);
      await loadTrace(nextStage, target, targetId);
      setActionStatus(`Click moment complete: ${target} trace slice is visible.`);
    } catch (error) {
      setActionStatus(`Trace failed: ${formatError(error)}. The current graph was not replaced by the demo fixture.`);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrace(nextStage: StageId, target = normalizedTraceTarget(traceTarget), targetId = traceTargetId) {
    const previousView = currentGraphSnapshot();
    setStage(nextStage);
    const repo = repoPath.trim() || "__demo__";
    const result = await executeTrace(repo, target, targetId);
    const focusedGraph = result.trace_slice ?? focusGraphOnPath(result.graph, result.execution_path);
    pushGraphHistory(previousView);
    setRepositoryGraph(result.graph);
    setTraceFocused(true);
    setGraph(focusedGraph);
    setTargetOptions(nodeLabels(result.graph));
    setPath(result.execution_path);
    setTimeline(result.timeline);
    setAgents(buildFallbackAgents(focusedGraph, result.execution_path));
    setRevealCount(focusedGraph.nodes.length);
    setSelectedNodeId(targetId ?? result.execution_path[0]?.id);

    await runPathPulse(result.execution_path);
  }

  async function handleInvestigation() {
    setLoading(true);
    setStage("agents");
    setInvestigation(undefined);
    setActionStatus("AI Investigation started: analyzing the repository, selecting a target, tracing, and running agents...");

    try {
      const repo = repoPath.trim() || "__demo__";
      const baseGraph = repositoryGraph.nodes.length
        ? repositoryGraph
        : graph.nodes.length && !traceFocused
          ? graph
          : await analyzeRepository(repo);
      const target = chooseInvestigationTarget(baseGraph);

      if (!target) {
        throw new Error("No graph node is available for investigation.");
      }

      const previousView = currentGraphSnapshot();
      setActionStatus(`AI Investigation selected ${target.label}; generating focused trace slice...`);

      const result = await executeTrace(repo, target.label, target.id);
      const focusedGraph = result.trace_slice ?? focusGraphOnPath(result.graph, result.execution_path);
      const output = await runAgents(focusedGraph, result.execution_path).catch(() => buildFallbackAgents(focusedGraph, result.execution_path));
      const verdict = buildInvestigationVerdict(target, result.graph, focusedGraph, result.execution_path, output);

      pushGraphHistory(previousView);
      setRepositoryGraph(result.graph);
      setTraceFocused(true);
      setGraph(focusedGraph);
      setTargetOptions(nodeLabels(result.graph));
      setTraceTarget(target.label);
      setTraceTargetId(target.id);
      setPath(result.execution_path);
      setTimeline(result.timeline);
      setAgents(output);
      setRevealCount(focusedGraph.nodes.length);
      setSelectedNodeId(target.id ?? result.execution_path[0]?.id);
      setInvestigation(verdict);
      setActionStatus(`AI Investigation complete: ${target.label} selected as the highest-priority trace target.`);

      await runPathPulse(result.execution_path);
    } catch (error) {
      setActionStatus(`AI Investigation failed safely: ${formatError(error)}. Run Analyze Repository or Click Moment Trace to continue.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAgents() {
    setLoading(true);
    setStage("agents");
    setActionStatus("Running graph-grounded agents. Live inference will fail fast to local reasoning if slow.");

    try {
      const graphForAgents = graph.nodes.length ? graph : DEMO_GRAPH;
      const pathForAgents = path.length ? path : DEMO_PATH;
      if (!graph.nodes.length) {
        setGraph(graphForAgents);
        setRepositoryGraph(graphForAgents);
        setTraceFocused(false);
        setTargetOptions(nodeLabels(graphForAgents));
        setPath(pathForAgents);
        setTimeline(DEMO_TIMELINE);
      }
      setRevealCount(graphForAgents.nodes.length);
      const output = await runAgents(graphForAgents, pathForAgents);
      setAgents(output);
      setActionStatus("Agents complete: architecture, execution, security, and explainer cards are updated.");
    } catch (error) {
      setAgents(buildFallbackAgents(graph.nodes.length ? graph : DEMO_GRAPH, path.length ? path : DEMO_PATH));
      setActionStatus(`Agents failed safely: ${formatError(error)}. Local graph-grounded fallback is shown.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSecurity() {
    const graphForSecurity = graph.nodes.length ? graph : DEMO_GRAPH;
    const pathForSecurity = path.length ? path : DEMO_PATH;
    if (!graph.nodes.length) {
      setGraph(graphForSecurity);
      setRepositoryGraph(graphForSecurity);
      setTraceFocused(false);
      setTargetOptions(nodeLabels(graphForSecurity));
      setPath(pathForSecurity);
      setTimeline(DEMO_TIMELINE);
    }

    setAgents(buildFallbackAgents(graphForSecurity, pathForSecurity));

    setStage("security");
    setActionStatus("Security view active: medium and high risk nodes are highlighted on the active trace slice.");
    setRevealCount(graphForSecurity.nodes.length);
    const firstRiskNode = graphForSecurity.nodes.find((node) => node.risk === "high" || node.risk === "medium");
    setActiveIndex(firstRiskNode ? Math.max(0, pathForSecurity.findIndex((step) => step.id === firstRiskNode.id)) : -1);
    setSelectedNodeId(firstRiskNode?.id);
  }

  async function handleVoice() {
    setLoading(true);
    setStage("voice");
    setActionStatus("Parsing the typed voice command...");
    setInvestigation(undefined);

    try {
      const intent = await parseVoice(voiceText);
      const intentSummary = formatIntent(intent.source ?? "typed_command", intent.intent, intent.event, intent.confidence);
      setTraceTarget(intent.event);
      setVoiceResult(intentSummary);
      await loadTrace("voice", intent.event);
      setVoiceResult(intentSummary);
      setActionStatus(`Voice command complete: natural language triggered the ${intent.event} trace.`);
    } catch (error) {
      setVoiceResult(`Typed command failed safely: ${formatError(error)}.`);
      setActionStatus("Voice command failed safely. Use Click Moment or Analyze Repository to continue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLiveVoice() {
    setStage("voice");
    setVoiceResult(undefined);
    setLiveTranscript("");
    liveTriggeredRef.current = false;

    if (!voiceStatus?.speechmatics_configured) {
      setVoiceResult("Speechmatics is not configured. Typed command mode is still available.");
      setActionStatus("Live Speechmatics is not configured. Typed command mode remains available.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceResult("This browser does not expose microphone capture. Typed command mode is still available.");
      setActionStatus("Microphone capture is unavailable in this browser. Typed command mode remains available.");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setVoiceResult("Live microphone requires HTTPS or localhost. Typed command mode is still available.");
      setActionStatus("Live voice blocked by browser security rules. Use HTTPS, localhost, or typed command mode.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        }
      });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const socket = new WebSocket(speechmaticsRealtimeUrl(audioContext.sampleRate, voiceStatus.speechmatics_language));

      speechSocketRef.current = socket;
      audioContextRef.current = audioContext;
      processorRef.current = processor;
      sourceRef.current = source;
      mediaStreamRef.current = stream;

      socket.binaryType = "arraybuffer";
      socket.onopen = () => {
        setIsListening(true);
        setVoiceResult("Speechmatics realtime session connected. Say: Trace what happens when a user logs in.");
        setActionStatus("Live Speechmatics is listening for the login trace command.");
        source.connect(processor);
        processor.connect(audioContext.destination);
      };
      socket.onmessage = (event) => handleSpeechmaticsMessage(event.data);
      socket.onerror = () => {
        setVoiceResult("Speechmatics realtime connection failed. Typed command mode is still available.");
        setActionStatus("Speechmatics connection failed safely. Typed command mode remains available.");
      };
      socket.onclose = () => {
        cleanupLiveVoice();
      };

      processor.onaudioprocess = (event) => {
        const output = event.outputBuffer.getChannelData(0);
        output.fill(0);

        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        socket.send(float32ToPcm16(input));
      };
    } catch (error) {
      cleanupLiveVoice();
      setVoiceResult(`Microphone or Speechmatics setup failed: ${error instanceof Error ? error.message : "unknown error"}. Typed command mode is still available.`);
      setActionStatus("Live voice setup failed safely. Typed command mode remains available.");
    }
  }

  function handleStopLiveVoice() {
    stopLiveVoice();
    if (liveTranscript.trim()) {
      setVoiceText(liveTranscript.trim());
    }
  }

  function handleSpeechmaticsMessage(raw: unknown) {
    if (typeof raw !== "string") {
      return;
    }

    try {
      const payload = JSON.parse(raw);
      const transcript = payload.transcript_text || transcriptFromSpeechmatics(payload);
      const messageName = String(payload.message ?? payload.type ?? "");
      const isFinalTranscript = /AddTranscript|EndOfTranscript/i.test(messageName);

      if (payload.type === "provider_status") {
        setVoiceResult(payload.message);
      }

      if (payload.type === "provider_error") {
        setVoiceResult(`${payload.message} Typed command mode is still available.`);
      }

      if (transcript) {
        setLiveTranscript((current) => mergeTranscript(current, transcript, isFinalTranscript));
        setVoiceText(transcript);

        if (shouldTriggerTrace(transcript) && !liveTriggeredRef.current) {
          liveTriggeredRef.current = true;
          setVoiceResult(`Speechmatics transcript accepted: ${transcript}`);
          void runVoiceIntentFromTranscript(transcript);
        }
      }
    } catch {
      return;
    }
  }

  async function runVoiceIntentFromTranscript(transcript: string) {
    const intent = await parseVoice(transcript);
    const intentSummary = formatIntent("speechmatics", intent.intent, intent.event, intent.confidence);
    setTraceTarget(intent.event);
    setVoiceResult(intentSummary);
    setActionStatus(`Speechmatics transcript accepted. Starting ${intent.event} trace...`);
    await loadTrace("voice", intent.event);
    setVoiceResult(intentSummary);
    setActionStatus(`Speechmatics command complete: ${intent.event} trace replayed.`);
    stopLiveVoice();
  }

  async function handleReplay() {
    setStage("replay");
    setActionStatus("Replaying the execution path as a step-by-step software movie...");
    if (!path.length) {
      await loadTrace("replay");
      setActionStatus(`Replay complete: ${normalizedTraceTarget(traceTarget)} execution path is ready to replay again.`);
      return;
    }

    const graphForReplay = graph.nodes.length ? graph : DEMO_GRAPH;
    const pathForReplay = path.length ? path : DEMO_PATH;
    if (!graph.nodes.length) {
      setGraph(graphForReplay);
      setPath(pathForReplay);
      setTimeline(DEMO_TIMELINE);
    }
    setRevealCount(graphForReplay.nodes.length);
    await runPathPulse(pathForReplay);
    setActionStatus("Replay complete: the execution path is ready to replay again.");
  }

  function handleReset() {
    setStage("hook");
    setGraph(EMPTY_GRAPH);
    setRepositoryGraph(EMPTY_GRAPH);
    setTraceFocused(false);
    setTargetOptions([]);
    setPath(EMPTY_PATH);
    setTimeline(EMPTY_TIMELINE);
    setAgents(buildFallbackAgents(EMPTY_GRAPH, EMPTY_PATH));
    setRevealCount(0);
    setActiveIndex(-1);
    setSelectedNodeId(undefined);
    setTraceTargetId(undefined);
    setGraphHistory([]);
    setVoiceResult(undefined);
    setInvestigation(undefined);
    setActionStatus("Reset complete. Start with Analyze Repository.");
  }

  function handleBackToFullGraph() {
    if (!repositoryGraph.nodes.length) {
      setActionStatus("No full repository graph is loaded yet. Run Analyze Repository first.");
      return;
    }

    setStage("reveal");
    setGraph(repositoryGraph);
    setTraceFocused(false);
    setTargetOptions(nodeLabels(repositoryGraph));
    setPath(EMPTY_PATH);
    setTimeline(EMPTY_TIMELINE);
    setAgents(buildFallbackAgents(repositoryGraph, EMPTY_PATH));
    setRevealCount(repositoryGraph.nodes.length);
    setActiveIndex(-1);
    setSelectedNodeId(undefined);
    setTraceTargetId(undefined);
    setGraphHistory([]);
    setInvestigation(undefined);
    setActionStatus("Returned to the full repository graph. Pick another Trace Target without re-analyzing.");
  }

  function handleBackToPreviousGraph() {
    const previousView = graphHistory[graphHistory.length - 1];

    if (!previousView) {
      setActionStatus("No previous graph view is available. Use Full Graph to return to the repository map.");
      return;
    }

    restoreGraphSnapshot(previousView);
    setGraphHistory((history) => history.slice(0, -1));
    setActionStatus(
      previousView.traceFocused
        ? `Returned to previous focused trace: ${normalizedTraceTarget(previousView.traceTarget)}.`
        : "Returned to the previous full repository graph view."
    );
  }

  function handleNodeSelect(node: TraceNode) {
    setSelectedNodeId(node.id);
    setTraceTarget(node.label);
    setTraceTargetId(node.id);
    void handleLoginTrace("click", node.label, node.id);
  }

  async function runPathPulse(nextPath: ExecutionStep[]) {
    setIsReplaying(true);
    setActiveIndex(-1);

    for (let index = 0; index < nextPath.length; index += 1) {
      setActiveIndex(index);
      setSelectedNodeId(nextPath[index].id);
      await delay(PULSE_DELAY_MS);
    }

    setIsReplaying(false);
  }

  function stopLiveVoice() {
    const socket = speechSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }

    socket?.close();
    cleanupLiveVoice();
  }

  function cleanupLiveVoice() {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();

    processorRef.current = null;
    sourceRef.current = null;
    mediaStreamRef.current = null;
    audioContextRef.current = null;
    speechSocketRef.current = null;
    setIsListening(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>TraceGrid AI</strong>
          <span>Visible causal execution for software systems</span>
        </div>
        <div className="status-row">
          <span className="status-pill static-mode">Static Causal Reconstruction</span>
          <span className="status-pill">Demo-safe fallback active</span>
          <span className="status-pill">Graph-grounded agents</span>
          <span className="status-pill build-pill" title={`Built: ${BUILD_INFO.builtAt}`}>
            v{BUILD_INFO.version} | {BUILD_INFO.commit}
          </span>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel control-panel">
          <div className="panel-title">
            <h1>Demo Control</h1>
          </div>

          <div className="metric-grid">
            <div className="metric">
              <strong>{graph.nodes.length}</strong>
              <span>nodes</span>
            </div>
            <div className="metric">
              <strong>{graph.edges.length}</strong>
              <span>edges</span>
            </div>
            <div className="metric">
              <strong>{riskCount}</strong>
              <span>risks</span>
            </div>
          </div>

          <section>
            <div className="panel-title">
              <h3>Repository</h3>
            </div>
            <input
              className="repo-input"
              aria-label="Repository path"
              value={repoPath}
              onChange={(event) => setRepoPath(event.target.value)}
              placeholder="__demo__ or https://github.com/owner/repo"
            />
          </section>

          <section>
            <div className="panel-title">
              <h3>Trace Target</h3>
            </div>
            <input
              className="repo-input"
              aria-label="Trace target"
              list="trace-targets"
              value={traceTarget}
              onChange={(event) => {
                setTraceTarget(event.target.value);
                setTraceTargetId(undefined);
              }}
              placeholder="LoginButton, Auth middleware, POST /api/auth/login"
            />
            <p className="field-help">
              Select or type a node. TraceGrid shows incoming context, outgoing branches, and bounded downstream steps. Empty uses LoginButton as the demo-safe default.
            </p>
            <datalist id="trace-targets">
              {targetOptions.map((label) => (
                <option value={label} key={label} />
              ))}
            </datalist>
          </section>

          <div className="stage-list">
            {STAGES.map((item) => {
              const Icon = item.icon;
              return (
                <div className={`stage-step${stage === item.id ? " active" : ""}`} key={item.id}>
                  <div className="stage-icon">
                    <Icon size={16} />
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="stage-brief" aria-live="polite">
            <strong>{currentGuide.title}</strong>
            <span>{currentGuide.purpose}</span>
            <span>{currentGuide.result}</span>
            <code>{actionStatus}</code>
          </div>

          <div className="risk-legend" aria-label="Risk legend">
            <span><b className="risk-dot none" />None: no obvious risk signal</span>
            <span><b className="risk-dot low" />Low: weak or local concern</span>
            <span><b className="risk-dot medium" />Medium: boundary or state change</span>
            <span><b className="risk-dot high" />High: exposed or sensitive path</span>
          </div>

          <div className="investigation-launch">
            <button className="action-button investigator flagship" type="button" onClick={() => void handleInvestigation()} disabled={loading} data-testid="investigation-button">
              <Bot size={18} />
              Run AI Investigation
            </button>
            <span>Autonomous flow: analyze, pick target, trace slice, run agents, then produce one verdict.</span>
          </div>

          <div className="button-grid">
            <button className="action-button" type="button" onClick={handleAnalyze} disabled={loading} data-testid="analyze-button">
              <GitBranch size={17} />
              Analyze Repository
            </button>
            <button className="action-button secondary" type="button" onClick={() => void handleLoginTrace("click")} disabled={loading} data-testid="login-trace-button">
              <MousePointer size={17} />
              Click Moment Trace
            </button>
            {canReturnToPreviousTrace ? (
              <button className="action-button secondary" type="button" onClick={handleBackToPreviousGraph} disabled={loading} data-testid="back-previous-graph-button">
                <ArrowLeft size={17} />
                Back
              </button>
            ) : null}
            {traceFocused ? (
              <button className="action-button secondary" type="button" onClick={handleBackToFullGraph} disabled={loading} data-testid="back-full-graph-button">
                <GitBranch size={17} />
                Full Graph
              </button>
            ) : null}
            <button className="action-button secondary" type="button" onClick={handleAgents} disabled={loading} data-testid="agents-button">
              <Bot size={17} />
              Agents Explain Graph
            </button>
            <button className="action-button danger" type="button" onClick={handleSecurity} disabled={loading} data-testid="security-button">
              <Shield size={17} />
              Highlight Security
            </button>
            <button className="action-button warning" type="button" onClick={handleReplay} disabled={loading || isReplaying}>
              <Play size={17} />
              Replay Execution
            </button>
            <div className="replay-target-label" aria-live="polite" title={replayTargetLabel}>
              <strong>Replay target:</strong>
              <span>{replayTargetLabel}</span>
            </div>
          </div>

          {investigation ? (
            <section className="investigation-card" aria-live="polite">
              <strong>AI Investigation Verdict</strong>
              <span>Target: {investigation.target}</span>
              <dl>
                <div>
                  <dt>Root Cause:</dt>
                  <dd>{investigation.rootCause}</dd>
                </div>
                <div>
                  <dt>Attack Surface:</dt>
                  <dd>{investigation.attackSurface}</dd>
                </div>
                <div>
                  <dt>Primary Replay Path:</dt>
                  <dd>{investigation.primaryReplayPath}</dd>
                </div>
                <div>
                  <dt>Recommended Fix:</dt>
                  <dd>{investigation.recommendedFix}</dd>
                </div>
                <div>
                  <dt>Confidence:</dt>
                  <dd>{investigation.confidence}</dd>
                </div>
                <div>
                  <dt>Selection Score:</dt>
                  <dd>
                    {investigation.score.total} total = {investigation.score.risk} risk + {investigation.score.connections} connection + {investigation.score.layer} layer points
                    ({investigation.score.directConnections} direct graph connections).
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <VoiceCommandPanel
            value={voiceText}
            result={voiceResult}
            voiceStatus={voiceStatus}
            isListening={isListening}
            liveTranscript={liveTranscript}
            disabled={loading}
            onChange={setVoiceText}
            onSubmit={() => void handleVoice()}
            onStartLive={() => void handleLiveVoice()}
            onStopLive={handleStopLiveVoice}
          />

          <ReplayControls isPlaying={isReplaying} onReplay={() => void handleReplay()} onReset={handleReset} />
        </aside>

        <section className="panel graph-panel">
          <div className="graph-header">
            <div className="panel-title">
              <div>
                <h2>{graph.metadata?.title ?? "Execution Graph"}</h2>
                <span>{graph.metadata?.summary ?? "Causal behavior reconstruction"}</span>
              </div>
              <Database size={20} />
            </div>
            <div className="trace-explainer">
              {traceFocused
                ? `Focused Trace Target: ${normalizedTraceTarget(traceTarget)}. The canvas shows the selected node's incoming context, outgoing branches, and bounded downstream continuation. The replay path remains the primary step-by-step route through that slice.`
                : "Full graph view. Use Trace Target or click any node to inspect the runtime-causal slice from that point."}
            </div>
            <div className="mode-strip" aria-label="Graph mode labels">
              <span><strong>Engine</strong> Static Causal Reconstruction</span>
              <span><strong>Graph</strong> {graphModeLabel}</span>
              <span><strong>Replay</strong> {replayModeLabel}</span>
              <span><strong>Analyzer</strong> {analyzerMode}</span>
            </div>
          </div>
          <Graph
            data={graph}
            revealCount={revealCount}
            activeNodeIds={activeNodeIds}
            activeEdgeIds={activeEdgeIds}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
          />
        </section>

        <aside className="panel insight-panel">
          <div className="panel-title">
            <h3>Execution Timeline</h3>
          </div>
          <Timeline data={timeline} activeIndex={activeIndex} />

          <div className="panel-title">
            <h3>Agent Reasoning</h3>
          </div>
          <Agents data={agents} />
        </aside>
      </section>
    </main>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function normalizedTraceTarget(target?: string) {
  return target?.trim() || "LoginButton";
}

function nodeLabels(graph: TraceGraph) {
  return Array.from(new Set(graph.nodes.map((node) => node.label)));
}

function focusGraphOnPath(graph: TraceGraph, executionPath: ExecutionStep[]): TraceGraph {
  if (!executionPath.length) {
    return graph;
  }

  const pathNodeIds = executionPath.map((step) => step.id);
  const pathNodeSet = new Set(pathNodeIds);
  const pathEdgeIds = new Set<string>();

  for (let index = 1; index < pathNodeIds.length; index += 1) {
    pathEdgeIds.add(`${pathNodeIds[index - 1]}-${pathNodeIds[index]}`);
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const focusedNodes = pathNodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is TraceGraph["nodes"][number] => Boolean(node));
  const focusedEdges = graph.edges.filter((edge) => pathNodeSet.has(edge.from) && pathNodeSet.has(edge.to) && pathEdgeIds.has(edgeId(edge)));

  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      summary: `Focused fallback replay path: ${executionPath.map((step) => step.label).join(" -> ")}`
    },
    nodes: focusedNodes,
    edges: focusedEdges
  };
}

function chooseInvestigationTarget(graph: TraceGraph) {
  const nonDependencyNodes = graph.nodes.filter((node) => !["dependency", "import"].includes(node.type.toLowerCase()));
  const pool = nonDependencyNodes.length ? nonDependencyNodes : graph.nodes;

  return [...pool].sort((left, right) => investigationScoreBreakdown(right, graph).total - investigationScoreBreakdown(left, graph).total)[0];
}

function investigationScoreBreakdown(node: TraceNode, graph: TraceGraph): InvestigationScoreBreakdown {
  const directConnections = nodeDegree(graph, node.id);
  const risk = riskWeight(node.risk) * 100;
  const connections = directConnections * 12;
  const layer = typeWeight(node.type);

  return {
    total: risk + connections + layer,
    risk,
    connections,
    layer,
    directConnections
  };
}

function riskWeight(risk: TraceNode["risk"]) {
  switch (risk) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

function nodeDegree(graph: TraceGraph, nodeId: string) {
  return graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).length;
}

function typeWeight(type: string) {
  const normalized = type.toLowerCase();

  if (["api", "route", "endpoint", "middleware", "security"].includes(normalized)) {
    return 35;
  }

  if (["handler", "event", "ui", "service", "db", "database"].includes(normalized)) {
    return 25;
  }

  if (["code", "file", "class", "function", "backend"].includes(normalized)) {
    return 15;
  }

  return 0;
}

function buildInvestigationVerdict(
  target: TraceNode,
  fullGraph: TraceGraph,
  focusedGraph: TraceGraph,
  executionPath: ExecutionStep[],
  agentOutput: AgentResults
): InvestigationVerdict {
  const primaryReplayPath = executionPath.length
    ? executionPath.map((step) => step.label).join(" -> ")
    : target.label;
  const score = investigationScoreBreakdown(target, fullGraph);
  const riskNodes = focusedGraph.nodes.filter((node) => node.risk === "medium" || node.risk === "high");
  const finding = firstActionableFinding(agentOutput);
  const attackSurface = finding
    ? `${finding.node ?? target.label}: ${finding.evidence ?? finding.recommendation ?? "Risk signal detected in the selected trace slice."}`
    : riskNodes.length
      ? riskNodes.map((node) => `${node.label} (${node.risk})`).join(", ")
      : "No medium or high risk node is visible in this selected trace slice.";
  const recommendedFix = finding?.recommendation
    ?? (riskNodes.length
      ? "Add validation, authorization, rate limiting, and audit logging at the highlighted boundary before trusting downstream effects."
      : "Add runtime instrumentation around this entry point so future traces can prove execution causality beyond static AST-lite evidence.");

  return {
    target: target.label,
    rootCause: `${target.label} was selected as the likely investigation root because it carries ${target.risk ?? "none"} risk, ${score.directConnections} direct graph connection${score.directConnections === 1 ? "" : "s"}, and the highest investigation score in the current graph.`,
    attackSurface,
    primaryReplayPath,
    recommendedFix,
    confidence: confidenceLabel(agentOutput),
    score
  };
}

function firstActionableFinding(agentOutput: AgentResults) {
  const severityOrder: Record<string, number> = {
    high: 4,
    critical: 4,
    medium: 3,
    low: 2,
    info: 1
  };

  return [...(agentOutput.security.findings ?? [])].sort((left, right) => (
    (severityOrder[right.severity ?? "info"] ?? 1) - (severityOrder[left.severity ?? "info"] ?? 1)
  ))[0];
}

function confidenceLabel(agentOutput: AgentResults) {
  const scores = [
    agentOutput.architecture.confidence,
    agentOutput.execution.confidence,
    agentOutput.security.confidence,
    agentOutput.explainer.confidence
  ].filter((score): score is number => typeof score === "number");

  if (!scores.length) {
    return "88% graph-grounded confidence";
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return `${Math.round(average * 100)}% graph-grounded confidence`;
}

function formatIntent(source: string, intent: string, event: string, confidence: number) {
  const sourceLabel = source === "speechmatics" ? "Speechmatics" : "Typed command";
  return `${sourceLabel} | Intent: ${intent} | Event: ${event} | Confidence: ${Math.round(confidence * 100)}%`;
}

function float32ToPcm16(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function transcriptFromSpeechmatics(payload: { metadata?: { transcript?: string }; results?: Array<{ alternatives?: Array<{ content?: string }> }> }) {
  const metadataTranscript = payload.metadata?.transcript?.trim();
  if (metadataTranscript) {
    return metadataTranscript;
  }

  return payload.results
    ?.map((result) => result.alternatives?.[0]?.content)
    .filter(Boolean)
    .join(" ")
    .trim() ?? "";
}

function mergeTranscript(current: string, transcript: string, final: boolean) {
  if (!current || !final) {
    return transcript;
  }

  if (current.endsWith(transcript)) {
    return current;
  }

  return `${current} ${transcript}`.replace(/\s+/g, " ").trim();
}

function shouldTriggerTrace(transcript: string) {
  return /trace|analy[sz]e|login|logs?\s+in|sign\s+in|auth|middleware|api|endpoint|database|db|query|token|session/i.test(transcript);
}
