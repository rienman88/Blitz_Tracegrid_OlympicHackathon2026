# TraceGrid AI Demo Readiness Checklist

## Direction Locked From Demo Script
- [x] Preserve the FastAPI backend plus Next/React frontend architecture.
- [x] Optimize the first screen for the 5-7 minute judging sequence, not a generic landing page.
- [x] Keep the core mental conclusion clear: "This system lets me see how software executes."
- [x] Build fallback behavior so the demo survives missing AI keys, Neo4j, Speechmatics, or repository path issues.

## Current Blockers Found
- [x] Frontend main page is empty.
- [x] Frontend package/runtime files are missing.
- [x] API helper files are empty.
- [x] Replay and voice views are empty.
- [x] Graph layout is random on every render, which breaks demo repeatability.
- [x] Backend `/analyze` imports `analyzers.static_analyzer`, but the folder is `analyzer`.
- [x] Backend timeline builder is empty.
- [x] Architecture agent is empty.
- [x] LLM adapter lives in `agents/base.py` while agents import `ai.featherless`.
- [x] Docker Compose references backend/frontend builds, but Dockerfiles are missing.

## Improvements To Implement
- [x] Add deterministic demo graph with UI -> handler -> API -> middleware -> DB flow.
- [x] Add stable execution path and timeline for the LoginButton click moment.
- [x] Add demo-safe AI agent outputs grounded in graph data when no external LLM key is available.
- [x] Build a dark, judge-facing demo cockpit around Graph Reveal, Click Moment, Agents, Security, Voice, and Replay.
- [x] Add voice intent simulation for "Trace what happens when a user logs in".
- [x] Add cinematic replay controls with visible execution pulses.
- [x] Add frontend/backend runtime metadata and Dockerfiles.
- [x] Run install/build/API checks.
- [x] Run browser verification.

## AST-Lite Upgrade
- [x] Keep deterministic demo fallback unchanged for judging safety.
- [x] Add Python AST extraction for functions, FastAPI routes, imports, auth boundaries, API calls, and DB operations.
- [x] Add TS/JS/TSX AST-lite extraction for imports, functions/components, JSX click handlers, network calls, auth boundaries, and DB operations.
- [x] Add safe repo ingestion limits and ignored folders.
- [x] Add evidence fields to graph nodes and edges: file path, line number, detector, and confidence.
- [x] Surface evidence/confidence in the UI selected-node panel.
- [x] Add repository path input while keeping `__demo__` as the default scripted flow.
- [x] Verify demo fallback still works after AST-lite changes.

## Existing Working Features Preserved
- [x] Keep `/analyze`, `/execute`, `/agents`, `/voice`, and `/ws` endpoint names.
- [x] Keep the component split: graph, agents, timeline.
- [x] Keep the Speechmatics-shaped voice endpoint as a text intent parser fallback.
- [x] Keep the Docker Compose service split: backend, frontend, neo4j, redis.

## Risk Notes
- [x] External LLM calls should not be required during judging.
- [x] Static analysis should be treated as a strong demo scaffold, not a production-grade parser.
- [x] Neo4j remains optional unless persistence is needed after the hackathon demo.

## Verification Log
- [x] Backend imports successfully.
- [x] `/health`, `/analyze`, `/execute`, `/agents`, and `/voice` pass local FastAPI TestClient checks.
- [x] Frontend production build passes on Next 16.2.6.
- [x] Runtime npm audit reports 0 vulnerabilities after overriding PostCSS to 8.5.14.
- [x] Browser pass verified Analyze Repository, LoginButton Trace, Run Agents, Security View, Voice Trace, and Replay on `http://localhost:3000`.
- [x] Browser console logs showed no errors or warnings during the final demo pass.
- [x] AST-lite API check scanned the TraceGrid project path and returned Python AST plus TypeScript AST evidence.
- [x] Browser check verified the repository path input can analyze the real TraceGrid folder and display evidence/confidence.

## Docker/Vultr Packaging
- [x] Add local Docker Compose stack for frontend, backend, Neo4j, and Redis.
- [x] Add production-style Docker Compose stack with Nginx as the only public entry point.
- [x] Keep demo fallback and AST-lite available inside containers.
- [x] Add backend Node/TypeScript runtime so TS AST bridge works in Docker.
- [x] Add environment examples for local and Vultr deployment.
- [x] Add Docker deployment runbook.
- [ ] Build and run local Docker stack.
- [ ] Build and run production-style Nginx stack locally.
- [x] Validate local and production Compose configuration.
- [x] Re-run frontend build and backend health/analyze checks after Docker changes.
- [x] Confirm runtime npm audit still reports 0 vulnerabilities.
- [ ] Docker daemon must be running before image build/run verification can complete.

## Vultr Deployment Execution
- [ ] Create or confirm Vultr Cloud Compute instance.
- [ ] Attach firewall rules: allow SSH from trusted IP, allow HTTP 80, allow HTTPS 443 when TLS is added.
- [ ] Keep raw backend/frontend/database ports closed publicly: 8000, 3000, 6379, 7474, 7687.
- [ ] Install Docker Engine and Docker Compose plugin on the server, or use a Docker-ready Vultr image.
- [ ] Upload current source or pull from Git repository.
- [ ] Create server `.env` from `.env.prod.example` and set provider keys.
- [ ] Run `docker compose -f docker-compose.prod.yml up -d --build`.
- [ ] Verify `/health`, GitHub ingestion, Trace Target, Agents, Replay, typed voice, and optional Speechmatics live voice.
- [ ] Add HTTPS before relying on live microphone from a public Vultr IP.

## Public GitHub Cleanup
- [x] Added public-facing README with local, production, environment, and Vultr deployment notes.
- [x] Hardened `.gitignore` so real env files, logs, local archives, screenshots, dependency folders, and build outputs stay out of the public repo.
- [ ] Initialize a clean Git repository inside the TraceGrid app folder.
- [ ] Create a new public GitHub repository.
- [ ] Push only sanitized project files to GitHub.

## Winning Submission Gaps
- [x] Add one explicit autonomous-agent failure reconstruction scenario, not only repository tracing.
- [x] Added `Run AI Investigation` control that analyzes/selects/traces/runs agents as one autonomous workflow.
- [x] Investigation verdict now reports Root Cause, Attack Surface, Primary Replay Path, Recommended Fix, and Confidence.
- [x] Frontend production build passes after adding the AI Investigation workflow.
- [x] Browser-verified local `Run AI Investigation` flow renders the verdict and completes against the demo-safe graph.
- [x] Added build/version badge inputs so the live UI can prove which Git commit was deployed.
- [x] Added explicit `Static Causal Reconstruction` mode label to protect credibility before runtime tracing exists.
- [x] Promoted `Run AI Investigation` as the flagship autonomous workflow control.
- [x] Added AI Investigation selection score breakdown: risk, connection, layer, and direct graph connection count.
- [x] Added graph mode labels for full repository graph, focused trace slice, and primary replay path.
- [x] Improved node and security-agent risk explanations with boundary-specific reasoning.
- [x] Frontend production build and backend security-agent syntax check pass after the static-causality credibility pass.
- [x] Browser-verified hardening pass: build badge, static mode, investigation score, graph mode labels, and risk reasoning render locally.
- [x] Clarified AI Investigation score language: `none` risk now displays as `0 risk signal + 100 baseline`, with a plain-English explanation that important does not mean dangerous.
- [ ] Add a concise in-app or README positioning statement: "Visual AI Runtime Intelligence" or "Causal Intelligence for Autonomous Systems."
- [ ] Add a demo script section that maps each button to the judge story: graph reveal, trace slice, primary replay path, agents, security, voice.
- [ ] Add a short architecture diagram to README or submission deck: ingestion, graph engine, agent reasoning, replay layer, deployment.
- [ ] Verify Featherless with a real key and select one live agent role for the demo.
- [ ] Verify Speechmatics live voice only after HTTPS is available; keep typed voice as the judged-safe option.
- [ ] Add a submission-ready limitations note: AST-lite is hackathon-grade reconstruction, runtime instrumentation is roadmap.
- [ ] Add a 60-90 second demo video flow centered on one killer story.

## Existing Vultr Instance Replacement
- [ ] SSH into `144.202.50.150` and identify what is currently running.
- [ ] Record current Docker containers, listening ports, compose folders, and service managers before stopping anything.
- [ ] Back up old app compose files, `.env` files, and any persistent volumes or upload directories.
- [ ] Stop the old public web service only after backup is confirmed.
- [ ] Deploy TraceGrid under `/opt/tracegrid` without deleting old app data.
- [ ] Verify TraceGrid through `http://144.202.50.150` before pruning old containers/images.
- [ ] Keep a rollback path until the hackathon demo is verified end to end.
- [ ] User requested destructive clean replacement: reinstall OS on existing Vultr instance if no old data needs preservation.
- [ ] Resolve post-reinstall SSH host-key mismatch only after confirming the current Vultr public IP in the dashboard.
- [x] Deployment probe: `144.202.50.150` has HTTP open but SSH closed, so it cannot be updated through SSH from this machine.
- [x] Deployment probe: `144.202.58.150` has SSH and HTTP open; changed host key was refreshed locally after the rebuild.
- [ ] SSH authentication pending for `144.202.58.150`; add local public key `blitz-amd` to `/root/.ssh/authorized_keys` or provide an authenticated server shell.
- [ ] After SSH auth works, pull GitHub commit `25b8caa` and rebuild with `docker compose -f docker-compose.prod.yml up -d --build`.
- [x] Public `http://144.202.58.150/health` responds with TraceGrid `ok`, but SSH still rejects the offered `blitz-amd` key, so latest commit `417f2df` has not been deployed yet.

## Hackathon Provider Integrations
- [x] Featherless uses real `/v1/chat/completions` inference when `FEATHERLESS_API_KEY` is configured.
- [x] Featherless live responses are normalized into agent cards while preserving structured local fallback.
- [x] Speechmatics typed command remains a first-class voice option, not a degraded fallback.
- [x] Speechmatics realtime microphone mode is wired through a backend WebSocket proxy so the browser never receives the API key.
- [x] Speechmatics status endpoint shows whether live voice is configured.
- [x] Docker and Vultr env files include Featherless and Speechmatics settings.
- [x] Frontend build passes after provider UI changes.
- [x] FastAPI checks pass for `/voice/status`, typed `/voice`, `/execute`, and `/agents`.
- [x] Docker Compose local and production configs include provider envs and validate.
- [x] Runtime npm audit reports 0 vulnerabilities after provider changes.
- [ ] Test Featherless with a real hackathon key.
- [ ] Test Speechmatics live microphone with a real hackathon key.

## Graph First-Frame And Fit Fix
- [x] Initial app load now uses an empty TraceGrid graph instead of pre-seeding `LoginButton` and `onClick handler`.
- [x] Demo fallback is preserved and enters only after Analyze Repository, LoginButton Trace, Agents, Security, Voice, or Replay actions.
- [x] Reset returns the graph to the same empty first-frame state.
- [x] Execution graph nodes now use responsive auto-layout instead of wide fixed demo coordinates.
- [x] SVG viewBox is calculated from graph content and the graph wrapper clips any future visual bleed into side panels.
- [x] Wrapped execution rows now route arrows by direction: rightward, downward, and leftward path steps all show arrowheads.
- [x] Frontend production build passes after the graph initialization and layout fixes.
- [x] Local Docker frontend image rebuild passes with the graph fix included.
- [x] Production-style Docker frontend image `tracegrid/tracegrid-frontend:latest` rebuilt and prod-style frontend/Nginx containers recreated.

## Demo Control Reliability Fix
- [x] Added in-app stage guidance so each button states its purpose, expected result, and current action status.
- [x] Renamed demo buttons for clarity: Click Moment Trace, Agents Explain Graph, Highlight Security, and Replay Execution.
- [x] Added frontend API timeouts so slow backend/provider calls fall back instead of freezing the UI.
- [x] Reduced replay pulse delay so Click Moment and Replay feel active rather than stalled.
- [x] Changed `/agents` to use deterministic graph-grounded outputs by default, with live Featherless selectable through `TRACEGRID_LIVE_AGENT`.
- [x] Added `FEATHERLESS_TIMEOUT_SECONDS` and `TRACEGRID_LIVE_AGENT` to local and production Compose configuration.
- [x] Rebuilt and recreated production-style backend, frontend, and Nginx containers after the reliability fix.
- [x] Verified `/agents` returns through Nginx and no longer times out in the deployable stack.

## Trace Target Generalization
- [x] Added a Trace Target input so users can trace nodes other than `LoginButton`.
- [x] Trace Target suggestions are populated from the currently analyzed graph node labels.
- [x] Click Moment Trace now uses the selected repository path and selected trace target.
- [x] Clicking a UI/event/API node updates the Trace Target and starts a trace from that node.
- [x] Typed and Speechmatics voice commands can name a target such as `Auth middleware`, `User DB query`, or `POST /api/auth/login`.
- [x] Demo execution targeting now preserves the full LoginButton path but can start at later nodes such as `Auth middleware`.
- [x] Verified deployable `/execute` returns `Auth middleware -> User DB query -> Token service -> Session store` when targeting `Auth middleware`.

## Trace Slice Fan-Out Fix
- [x] Backend `/execute` now returns a `trace_slice` graph around the selected node instead of only a single linear path.
- [x] Trace slices include direct incoming context, all bounded outgoing branches, and downstream continuation up to safe demo limits.
- [x] Frontend Click Moment Trace now renders `trace_slice` when available, preserving the linear `execution_path` for replay and ordered agent narration.
- [x] In-app Trace Target explanation now distinguishes the canvas trace slice from the primary replay path.
- [x] Rebuild and verify deployable backend/frontend/Nginx after trace-slice fan-out wiring.
- [x] Verified GitHub trace target `tests/test_itsdangerous/test_serializer.py` renders a 40-node / 39-edge trace slice through Nginx.
- [x] Verified demo `Auth handler` target keeps incoming API context and downstream auth/database/session continuation.
- [x] Rebuilt active local Docker images after stale-container incident: `tracegrid-backend:local` and `tracegrid-frontend:local`.
- [x] Recreated active local backend/frontend containers and verified `/execute` returns `trace_slice=true` with 40 nodes / 39 edges for a GitHub target.
- [x] Updated deployable Docker images: `tracegrid-backend:latest` and `tracegrid-frontend:latest`.
- [x] Verified the deployable frontend `latest` image contains the updated trace-slice UI copy.

## GitHub Fetch / Docker Routing Fix
- [x] Verified backend GitHub analysis still works directly at `/analyze`.
- [x] Changed frontend REST calls to support same-origin API routing instead of relying on browser-side `localhost:8000`.
- [x] Added Next rewrites for `/health`, `/analyze`, `/execute`, `/agents`, `/voice`, and `/voice/status` to proxy to `backend:8000` inside Docker.
- [x] Increased repository analyze/execute timeout to 45 seconds so public GitHub ingestion has room to finish.
- [x] Updated local and production env examples to keep `NEXT_PUBLIC_API_BASE_URL` empty and use `INTERNAL_API_BASE_URL=http://backend:8000`.
- [x] Rebuilt and recreated the active local frontend container after the routing fix.
- [x] Tagged the fixed local frontend/backend images as deployable `latest`.
- [x] Verified `http://localhost:3000/analyze` and `http://localhost/analyze` both return the GitHub AST-lite graph.
- [x] Browser verified GitHub Analyze Repository and Click Moment Trace without `Failed to fetch`.

## Strict Per-Node Trace Scope
- [x] Fixed node-click traces to send the exact graph node id, not just the visible label.
- [x] Backend `/execute` now accepts `target_id` and resolves the exact clicked node before falling back to label matching.
- [x] Focused trace slices for files/functions/classes/routes are constrained to edges with the same evidence file.
- [x] Focused trace slices for dependency/import nodes are constrained to direct edges from that exact import node's evidence file.
- [x] Synthetic audit verified `agents/crewai_slice.py` trace excludes unrelated `app.py -> time` context.
- [x] API verified `src/itsdangerous/timed.py` trace returns only edges backed by `src/itsdangerous/timed.py` evidence.
- [x] API verified exact `time` dependency target returns only `src/itsdangerous/timed.py -> time`.
- [x] Rebuilt active local backend/frontend containers and retagged fixed images as deployable `latest`.

## Graph View History Navigation
- [x] Added a previous-graph history stack so users can step back through focused trace views.
- [x] Kept Full Graph as a separate explicit escape route to the analyzed repository map.
- [x] Back appears only when the previous view is another focused trace, avoiding a duplicate full-graph action.
- [x] Analyze Repository, Reset, and Full Graph clear stale navigation history so old graph states do not leak into a new demo flow.
- [x] Re-run frontend build after graph history navigation change.
- [x] Rebuilt active local/deployable frontend image after graph history navigation change.
- [x] Recreated the running frontend container and retagged `tracegrid/tracegrid-frontend:latest`.
- [x] Browser verified Back stays hidden after the first focused trace because Full Graph already handles that route.
- [x] Browser verified Full graph -> LoginButton trace -> Auth middleware trace -> Back returns to the LoginButton trace, not the full graph.
- [x] Browser verified Full Graph still returns to the repository map and clears graph history.

## Agent Trace Slice Explanation
- [x] Added Trace Slice Summary so agents explain visible branch breadth separately from the animation path.
- [x] Added Primary Replay Path wording so the selected replay path is clearly identified as one animation route.
- [x] Added grouped Branch List output for declares, imports, and calls/continues.
- [x] Patched backend architecture, execution, and explainer agent fallbacks.
- [x] Patched frontend local graph-grounded fallback agents for the same explanation structure.
- [x] Re-run frontend build and backend syntax checks after the agent explanation patch.
- [x] Rebuild active Docker backend/frontend images after the agent explanation patch.
- [x] Recreated running backend/frontend containers; Compose reports both services healthy after the patch.
- [x] API verified a file-node trace now shows Trace Slice Summary, Primary Replay Path, and grouped Branch List output.
- [x] Running backend verified `agents/trace_summary.py` file trace shows both slice summary and primary replay path.
- [x] Browser verified agent cards show Trace Slice Summary, Primary Replay Path, and grouped Branch List after Docker rebuild.

## Replay Target Clarity
- [x] Added a visible `Replay target:` label beside the Replay Execution control.
- [x] Replay label uses the active primary replay path, separate from the broader visible trace slice.
- [x] Re-run frontend build after Replay target label change.
- [x] Rebuild and recreate active local frontend container after Replay target label change.
- [x] Retagged `tracegrid/tracegrid-frontend:latest` after Replay target label change.
- [x] Browser verified `Replay target:` updates to the active LoginButton primary path after Click Moment Trace.
- [x] Package deployable source archive after Replay target label change.
- [x] Verified deployment archive excludes `.env`, `.env.prod`, node_modules, `.next`, logs, screenshots, and old tarballs.
- [x] Rebuilt deployment archive after adding README and public GitHub cleanup.

## Replay, Voice, And Target Bugfix
- [x] Fixed Click Moment Trace so typed Trace Target values are used instead of silently falling back to `LoginButton`.
- [x] Changed replay edge activation to follow the ordered execution path, so arrows light up from node to node during the replay sequence.
- [x] Changed trace actions to focus the graph canvas on the selected execution path instead of showing the full repository graph.
- [x] Kept Analyze Repository as the full-system reveal while Click Moment, Voice, node-click trace, and Replay remain runtime-path focused.
- [x] Node clicks now trace from any selected graph node, not only UI/API nodes.
- [x] Added Back to Full Graph so users can return from a focused trace without re-analyzing the repository.
- [x] Agent cards now refresh automatically after Analyze, Trace Target, Security, and Back to Full Graph actions.
- [x] Execution Agent now renders ordered trace steps instead of hiding them in data only.
- [x] Security Agent wording now reflects the actual visible risk tags, including low/none paths with no medium/high findings.
- [x] Explainer Agent now generates step-by-step causal explanations with evidence, edge labels, and why focused paths can be short.
- [x] Added in-app Trace Target explanation and risk legend for None, Low, Medium, and High.
- [x] Moved selected-node evidence below the graph canvas so it no longer covers bottom graph nodes.
- [x] Frontend production build passes after focused trace graph change.
- [x] Deployable frontend image rebuilt and frontend/Nginx containers recreated after focused trace graph change.
- [x] Browser verified Auth middleware trace focuses to 4 nodes / 3 edges, shows Back to Full Graph, and renders 4 Execution Agent steps.
- [x] Browser verified Back to Full Graph returns to 8 nodes / 7 edges without re-running Analyze Repository.
- [x] Deployable API still returns a dedicated `Auth middleware -> User DB query -> Token service -> Session store` trace path.
- [x] Terminal/static Trace Targets now include nearest upstream source context, so dependency nodes such as `from fastapi.staticfiles` render with their importing file instead of as detached single boxes.
- [x] Unknown Trace Targets now return a clear API error instead of silently tracing the first available file or demo node.
- [x] Live Speechmatics now accepts partial or final transcript payloads and triggers on broader trace/security/API/database keywords.
- [x] Live Speechmatics now extracts current realtime transcripts from `metadata.transcript`, matching the provider's realtime message shape.
- [x] Backend Speechmatics proxy now mints a temporary realtime JWT before connecting instead of sending the long-lived API key as the `jwt` query value.
- [x] Added browser secure-context messaging so live microphone failures point users to HTTPS, localhost, or typed command mode.
- [x] Documented that Vultr public-IP microphone demos require HTTPS; localhost testing can use the microphone without TLS.
- [x] Re-run frontend production build after the replay/voice/target patch.
- [x] Re-run backend and frontend production builds after the Speechmatics JWT patch.
- [x] Rebuild and recreate the deployable backend/frontend/Nginx containers after the patch.
- [x] Verified Speechmatics realtime JWT creation without printing the token.
- [x] Verified the backend can open a Speechmatics realtime WebSocket session and receive a provider message.
- [x] Re-checked replay and typed voice through the browser after the deployable rebuild.
- [x] Re-checked non-login Trace Target through the deployable API after the rebuild; browser text-entry verification was blocked by the automation clipboard, but the same UI behavior was verified before the backend-only Speechmatics patch.

## GitHub URL Ingestion
- [x] Repository input accepts public `https://github.com/{owner}/{repo}` URLs.
- [x] Backend validates GitHub-only HTTPS URLs and rejects arbitrary hosts.
- [x] Backend downloads the public GitHub ZIP archive into a temporary directory, scans it, and deletes it after analysis.
- [x] GitHub ingestion reuses the existing AST-lite limits for supported extensions, max files, and max file size.
- [x] Added `ALLOW_GITHUB_INGESTION` and `GITHUB_CLONE_TIMEOUT_SECONDS` environment controls.
- [x] Frontend repository input placeholder now shows the GitHub URL pattern.
- [x] Regression guard: real repository and GitHub analysis can no longer silently return the Milan login demo fallback.
- [x] Frontend now allows the demo fallback only for `__demo__`; GitHub/API errors remain visible and keep the current graph unchanged.
- [x] Backend now returns an HTTP error for inaccessible real paths, invalid GitHub URLs, disabled GitHub ingestion, and GitHub download/extraction failures.
- [x] Rebuilt and recreated deployable backend/frontend/Nginx after the GitHub fallback regression fix.
- [x] Verified deployable `/analyze` returns `github-ast-lite`, 286 nodes, and 271 edges for `https://github.com/pallets/itsdangerous`.
- [x] Verified invalid GitHub input returns an explicit API error instead of the login demo graph.
- [x] Verified local source analysis on `https://github.com/pallets/itsdangerous`.
- [x] Verified deployable `/analyze` returns `github-ast-lite` with 15 files, 286 nodes, and 271 edges for `github.com/pallets/itsdangerous`.
