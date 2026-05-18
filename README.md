# TraceGrid AI

Blitz TraceGrid is a hackathon demo system for visible causal execution understanding. It turns a repository or demo fixture into a graph that separates two ideas:

- **Trace slice:** the visible connected context around a selected node.
- **Primary replay path:** the ordered path used for animation and explanation.

The project is built for the Milan AI Week hackathon demo flow: graph reveal, click-moment trace, graph-grounded agents, security highlighting, voice command mode, and replay.

## What It Shows

- Repository analysis with AST-lite extraction for Python and TS/JS/TSX.
- Public GitHub URL ingestion for real-world demo flow.
- Focused trace targets by node label, selected suggestion, or clicked graph node.
- Replay target labeling so the animated path is explicit.
- Graph-grounded agent cards for architecture, execution, security, and explanation.
- Brief explanations beside the timeline, agent cards, and risk reasoning so non-technical judges can understand what each panel means.
- Featherless inference integration when configured.
- Speechmatics typed command mode and optional realtime microphone mode for analyze, trace, agents, security, and replay controls.
- Docker Compose local and production-style deployment.

## Brief Explanations

TraceGrid now includes short layman's explanations in the main demo panels:

- **Execution Timeline:** explains that the timeline is the simplified story of the selected replay path.
- **Agent Reasoning:** explains that the agents translate the same graph into structure, risk, execution, and narrative meaning.
- **Security Agent:** explains that security findings are about places where APIs, auth, sessions, input, or data access may need review.
- **Execution Agent:** explains that replay follows a breadcrumb trail through the graph, not live runtime tracing yet.
- **Explainer Agent:** explains the technical graph as a story for non-engineers.
- **Risk Reasoning:** explains that important does not automatically mean dangerous; static analysis can miss runtime-only behavior.

## Demo Controls

- **Analyze Repository:** loads the full system graph and clears stale Trace Target selections.
- **Trace Target:** selecting a listed node immediately runs its focused trace slice; typing a custom target still works with Click Moment Trace.
- **Click Moment Trace:** runs the selected target, or the full LoginButton demo path when the target is empty.
- **Highlight Security Risks:** highlights visible low, medium, and high static risk signals. These are review targets, not confirmed vulnerabilities.
- **Replay Execution Flow:** replays the active primary path in order.
- **Voice Control:** typed or Speechmatics commands can trigger analyze, trace, agents, security highlighting, AI investigation, or replay.

## Local Run

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

Backend health:

```bash
curl http://localhost:8000/health
```

## Production-Style Run

```bash
cp .env.prod.example .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Open:

```text
http://localhost
```

## Environment

Do not commit real `.env` files. Use the example files as templates:

- `.env.example`
- `.env.prod.example`

Important optional provider settings:

```env
FEATHERLESS_API_KEY=
FEATHERLESS_MODEL=Qwen/Qwen3-Coder-30B-A3B-Instruct
TRACEGRID_LIVE_AGENT=none
SPEECHMATICS_API_KEY=
ALLOW_GITHUB_INGESTION=true
```

For public Vultr demos, typed voice works over HTTP. Live microphone mode usually requires HTTPS because browsers restrict microphone access outside secure contexts.

## Vultr Deploy

Upload the project or pull it from GitHub, then run:

```bash
cp .env.prod.example .env
nano .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml --env-file .env ps
curl http://127.0.0.1/health
```

For live Speechmatics microphone mode on Vultr, use a real domain with HTTPS. Public `http://IP` access is not a browser secure context, so microphone capture can remain blocked even when the Speechmatics API key is valid. The repository includes:

- `docker-compose.https.yml`
- `deploy/nginx.https.conf`
- `deploy/certbot-www/`

The HTTPS path uses Let’s Encrypt certificates from `/etc/letsencrypt` and a stable symlink at `/etc/letsencrypt/live/tracegrid`. See `DOCKER_DEPLOYMENT.md` for the exact domain and Certbot commands.

Only Nginx should be public. Keep raw ports closed:

- `443` should be public only when HTTPS is enabled.
- `3000`
- `8000`
- `6379`
- `7474`
- `7687`

## Demo Safety

TraceGrid includes deterministic demo fallback behavior so the presentation still works without external keys. Real provider keys improve the demo, but the core graph, replay, typed voice, and local graph-grounded agents remain usable without them.
