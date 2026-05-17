# TraceGrid AI

Blitz TraceGrid is a hackathon demo system for visible causal execution understanding. It turns a repository or demo fixture into a graph that separates two ideas:

- **Trace slice:** the visible connected context around a selected node.
- **Primary replay path:** the ordered path used for animation and explanation.

The project is built for the Milan AI Week hackathon demo flow: graph reveal, click-moment trace, graph-grounded agents, security highlighting, voice command mode, and replay.

## What It Shows

- Repository analysis with AST-lite extraction for Python and TS/JS/TSX.
- Public GitHub URL ingestion for real-world demo flow.
- Focused trace targets by node label or clicked graph node.
- Replay target labeling so the animated path is explicit.
- Graph-grounded agent cards for architecture, execution, security, and explanation.
- Featherless inference integration when configured.
- Speechmatics typed command mode and optional realtime microphone mode.
- Docker Compose local and production-style deployment.

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

Only Nginx should be public. Keep raw ports closed:

- `3000`
- `8000`
- `6379`
- `7474`
- `7687`

## Demo Safety

TraceGrid includes deterministic demo fallback behavior so the presentation still works without external keys. Real provider keys improve the demo, but the core graph, replay, typed voice, and local graph-grounded agents remain usable without them.
