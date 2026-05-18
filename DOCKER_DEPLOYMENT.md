# TraceGrid Docker Runbook

## Local Test

First make sure Docker Desktop is running. On Windows, this must show server details, not a daemon connection error:

```powershell
docker info
```

1. Copy the environment file:

```powershell
Copy-Item .env.example .env
```

2. Build the images:

```powershell
docker compose build
```

3. Start the stack:

```powershell
docker compose up -d
```

4. Verify:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8000/health
```

Open:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health
- Neo4j browser, local only: http://localhost:7474

5. Stop:

```powershell
docker compose down
```

Use this when you need to remove local database volumes too:

```powershell
docker compose down -v
```

## Production-Style Local Test

This simulates the Vultr shape: Nginx is public, frontend/backend are internal, and browser API calls use the same origin.

```powershell
Copy-Item .env.prod.example .env
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Open:

- App through Nginx: http://localhost
- Health through Nginx: http://localhost/health

Stop:

```powershell
docker compose -f docker-compose.prod.yml down
```

## Push Images Later

Set the registry namespace in `.env`:

```env
IMAGE_NAMESPACE=registry.example.com/tracegrid
IMAGE_TAG=v1
```

Build and push:

```powershell
docker compose build
docker compose push backend frontend
```

On a Vultr server, pull and run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Vultr Deployment Shape

Recommended first deployment:

- Use a Vultr Ubuntu server or Vultr Docker Marketplace app.
- Open inbound TCP `80` for the Nginx service.
- Open inbound TCP `443` once you enable HTTPS for live microphone demos.
- Keep `8000`, `3000`, `6379`, `7474`, and `7687` closed to the public internet.
- Open SSH only from your own IP if possible.
- Live Speechmatics microphone mode on Vultr requires HTTPS with a trusted certificate. A raw public IP over `http://` is not enough for browser microphone access.

Brutal security note: do not expose Neo4j, Redis, or raw backend ports publicly. Docker published ports can expose services outside the container host, so bind local-only ports for local tooling and use Nginx for public traffic.

## Provider Keys

Set these in `.env` before the final hackathon recording:

```env
FEATHERLESS_API_KEY=your-featherless-key
FEATHERLESS_MODEL=Qwen/Qwen3-Coder-30B-A3B-Instruct
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
SPEECHMATICS_API_KEY=your-speechmatics-key
SPEECHMATICS_MP_URL=https://mp.speechmatics.com
SPEECHMATICS_JWT_TTL_SECONDS=60
SPEECHMATICS_RT_URL=wss://eu2.rt.speechmatics.com/v2
SPEECHMATICS_AUTH_QUERY=jwt
SPEECHMATICS_LANGUAGE=en
SPEECHMATICS_OPERATING_POINT=enhanced
```

Without provider keys, TraceGrid still works with typed command mode and local graph-grounded agent fallbacks. With keys, Featherless powers live agent reasoning and Speechmatics powers live microphone transcription through the backend WebSocket proxy.

Speechmatics live voice uses the API key server-side to mint a short-lived realtime JWT, then connects to the realtime WebSocket with that JWT. Keep `SPEECHMATICS_API_KEY` only on the backend/Vultr `.env` file; do not expose it to frontend build args.

Browser microphone access requires a secure context. `localhost` works for local testing, but a public Vultr IP over plain `http://` will usually block `navigator.mediaDevices`; use HTTPS before relying on the live Speechmatics microphone in the judged demo.

## Enable HTTPS On Vultr

You need a real domain name pointing to the Vultr IP. Let’s Encrypt will not issue a normal trusted certificate for a bare IP address.

1. Point a DNS `A` record at the Vultr server:

```text
tracegrid.your-domain.com -> 144.202.58.150
```

2. Keep your existing `/opt/tracegrid/.env`. Only adjust origins:

```bash
cd /opt/tracegrid
cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)"
grep -q '^ALLOWED_ORIGINS=' .env && sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://tracegrid.your-domain.com|' .env || echo 'ALLOWED_ORIGINS=https://tracegrid.your-domain.com' >> .env
```

3. Start the HTTP stack so Certbot can answer the ACME challenge:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d nginx
sudo apt update
sudo apt install -y certbot
sudo certbot certonly --webroot -w /opt/tracegrid/deploy/certbot-www -d tracegrid.your-domain.com
```

4. Create the stable certificate path expected by `deploy/nginx.https.conf`:

```bash
sudo ln -sfn /etc/letsencrypt/live/tracegrid.your-domain.com /etc/letsencrypt/live/tracegrid
```

5. Rebuild the frontend with same-origin HTTPS calls, then start the HTTPS override:

```bash
cd /opt/tracegrid
export NEXT_PUBLIC_GIT_SHA="$(git rev-parse --short HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml --env-file .env build --no-cache frontend
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml --env-file .env up -d --force-recreate backend frontend nginx
```

6. Verify:

```bash
curl -I https://tracegrid.your-domain.com/health
curl https://tracegrid.your-domain.com/voice/status
```

Open the app at:

```text
https://tracegrid.your-domain.com
```

Speechmatics should show as configured if `SPEECHMATICS_API_KEY` is present in `/opt/tracegrid/.env`. The live microphone button should work only after the page is loaded over trusted HTTPS.

## Vultr Server Commands

On the server:

```bash
sudo apt update
sudo apt install -y git
git clone <your-repo-url> tracegrid
cd tracegrid
cp .env.prod.example .env
export NEXT_PUBLIC_GIT_SHA="$(git rev-parse --short HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

If using pushed images instead of building on the server:

```bash
docker login <your-registry>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Operational Checks

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
docker compose -f docker-compose.prod.yml logs --tail=100 nginx
curl http://localhost/health
```

## Troubleshooting

If `docker compose build` fails with a message like `failed to connect to the docker API`, Docker Desktop or the Linux engine is not running. Start Docker Desktop manually, wait until it says the engine is running, then retry:

```powershell
docker info
docker compose build
docker compose up -d
```

## Known Production Gaps

- No authentication is protecting the demo UI.
- Neo4j and Redis are present for future architecture but are not required by the current demo flow.
- Full runtime tracing is still future work; AST-lite is evidence-backed static reconstruction.
