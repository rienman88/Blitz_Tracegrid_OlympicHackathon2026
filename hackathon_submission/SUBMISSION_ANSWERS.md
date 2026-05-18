# Blitz TraceGrid Submission Answers

## Basic Information

### Submission Title

Blitz TraceGrid

### Short Description

Blitz TraceGrid turns software repositories into visual causal execution graphs, then uses AI agents to explain replay paths, security risk, and root-cause evidence in plain language.

### Long Description

Blitz TraceGrid is a visual AI runtime-intelligence prototype for understanding how software behaves. Modern teams can generate code quickly, but they still struggle to answer a harder question: what actually happens when a user action, API route, agent workflow, or security-sensitive path executes?

TraceGrid analyzes a local repository or public GitHub URL, extracts AST-lite evidence from Python and TypeScript/JavaScript code, and reconstructs a causal graph across UI, API, backend, security, and data layers. A user can inspect the full system map, select any trace target, and convert that node into a focused trace slice with a primary replay path.

The project adds specialized AI reasoning on top of the graph: an Architecture Agent explains system structure, a Security Agent identifies visible attack surfaces, an Execution Agent reconstructs the selected flow, and an Explainer Agent converts the technical graph into a plain-language story. The Run AI Investigation flow makes this autonomous: it analyzes the repository, selects a high-priority target, generates a trace slice, runs agents, and returns a verdict with root cause, attack surface, replay path, recommended fix, and confidence.

TraceGrid is deployed as a production-shaped web app using Docker, FastAPI, Next.js, Vultr, Featherless inference, and Speechmatics voice controls. The current version is intentionally honest: it is a static causal reconstruction engine with demo-safe fallback behavior, and the roadmap extends it toward real runtime instrumentation, OpenTelemetry/eBPF tracing, and deterministic replay.

## Participation Mode

Recommended answer: Online

Use Onsite only if you physically participated at Milan AI Week in Milan.

## Categories

Recommended event tracks:

- Intelligent Reasoning
- Agentic Workflows
- Enterprise Utility
- Collaborative Systems
- Multimodal Intelligence

If the portal allows only one primary category, choose:

Enterprise Utility

Backup choice:

Agentic Workflows

## Technologies Used

- Python
- FastAPI
- Next.js
- React
- TypeScript
- Docker
- Docker Compose
- Nginx
- Vultr Cloud Compute
- Featherless AI inference
- Speechmatics realtime speech-to-text
- GitHub public repository ingestion
- Python AST parsing
- TypeScript/JavaScript AST-lite parsing
- WebSocket voice proxy
- Graph-based causal reconstruction
- Multi-agent reasoning
- Static causal replay
- Optional Redis
- Optional Neo4j

## Brutal Positioning Note

Do not position Blitz TraceGrid as a generic code viewer, chatbot, or code summarizer. The strongest submission framing is:

> Blitz TraceGrid is the explainability layer for autonomous software execution.

Do not claim true runtime tracing yet. The credible wording is:

> Today, TraceGrid performs graph-grounded static causal reconstruction. The roadmap is runtime instrumentation and deterministic replay.

That distinction protects the project during technical judging.
