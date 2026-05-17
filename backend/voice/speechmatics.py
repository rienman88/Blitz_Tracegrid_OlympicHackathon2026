import asyncio
import json
import os
from urllib.parse import quote, urlencode

import requests
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

SPEECHMATICS_DEFAULT_RT_URL = "wss://eu2.rt.speechmatics.com/v2"


@router.get("/voice/status")
def voice_status():
    return {
        "typed_command_available": True,
        "speechmatics_configured": bool(os.getenv("SPEECHMATICS_API_KEY")),
        "speechmatics_language": os.getenv("SPEECHMATICS_LANGUAGE", "en"),
        "speechmatics_mode": "realtime_proxy",
        "speechmatics_auth_mode": "temporary_realtime_jwt",
    }


@router.post("/voice")
def voice(payload: dict):
    text = payload.get("text", "")
    return _intent_from_text(text, source="typed_command")


@router.websocket("/speechmatics/ws")
async def speechmatics_realtime(websocket: WebSocket):
    await websocket.accept()

    api_key = os.getenv("SPEECHMATICS_API_KEY")
    if not api_key:
        await websocket.send_json({
            "type": "provider_error",
            "message": "Speechmatics API key is not configured. Typed command mode remains available.",
        })
        await websocket.close(code=1011)
        return

    sample_rate = _safe_int(websocket.query_params.get("sample_rate"), 48000)
    language = websocket.query_params.get("language") or os.getenv("SPEECHMATICS_LANGUAGE", "en")
    operating_point = os.getenv("SPEECHMATICS_OPERATING_POINT", "enhanced")

    try:
        access_token = await asyncio.to_thread(_speechmatics_access_token, api_key)

        async with websockets.connect(_speechmatics_url(access_token), max_size=8 * 1024 * 1024) as speechmatics:
            await speechmatics.send(json.dumps(_start_recognition(sample_rate, language, operating_point)))
            await websocket.send_json({
                "type": "provider_status",
                "message": "Speechmatics realtime session started.",
                "sample_rate": sample_rate,
                "language": language,
            })

            client_to_provider = asyncio.create_task(_client_audio_to_speechmatics(websocket, speechmatics))
            provider_to_client = asyncio.create_task(_speechmatics_to_client(websocket, speechmatics))

            done, pending = await asyncio.wait(
                {client_to_provider, provider_to_client},
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in pending:
                task.cancel()

            for task in done:
                exc = task.exception()
                if exc:
                    raise exc
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await _safe_send_json(websocket, {
            "type": "provider_error",
            "message": f"Speechmatics realtime unavailable: {exc.__class__.__name__}",
        })


def _intent_from_text(text, source):
    normalized = text.lower()
    event = _event_from_text(text)

    return {
        "intent": "execute_trace",
        "query": text,
        "event": event,
        "source": source,
        "confidence": 0.94 if "trace" in normalized or "login" in normalized else 0.72,
        "actions": [
            "parse_intent",
            "select_execution_path",
            "start_replay",
        ],
    }


def _event_from_text(text):
    normalized = text.lower()

    explicit = _after_keyword(normalized, "trace")
    if explicit:
        if "user logs in" in explicit or explicit in {"login", "login button"}:
            return "LoginButton"
        return explicit

    explicit = _after_keyword(normalized, "analyze")
    if explicit:
        if "user logs in" in explicit or explicit in {"login", "login button"}:
            return "LoginButton"
        return explicit

    if "auth middleware" in normalized:
        return "Auth middleware"
    if "auth handler" in normalized:
        return "Auth handler"
    if "database" in normalized or "db query" in normalized or "user db" in normalized:
        return "User DB query"
    if "token" in normalized:
        return "Token service"
    if "session" in normalized:
        return "Session store"
    if "api" in normalized or "endpoint" in normalized:
        return "POST /api/auth/login"
    if "signup" in normalized or "register" in normalized:
        return "SignupButton"
    if "logout" in normalized:
        return "LogoutButton"

    return "LoginButton"


def _after_keyword(normalized, keyword):
    marker = f"{keyword} "
    if marker not in normalized:
        return ""

    candidate = normalized.split(marker, 1)[1]
    for prefix in [
        "what happens when ",
        "the ",
        "a ",
        "an ",
        "node ",
        "event ",
        "flow ",
    ]:
        if candidate.startswith(prefix):
            candidate = candidate[len(prefix):]

    candidate = candidate.strip(" .?!")
    if not candidate or candidate in {"what happens", "what happens when a user logs in", "when a user logs in"}:
        return ""

    return candidate


async def _client_audio_to_speechmatics(websocket, speechmatics):
    while True:
        message = await websocket.receive()

        if message.get("bytes"):
            await speechmatics.send(message["bytes"])
            continue

        text = message.get("text")
        if not text:
            continue

        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue

        if payload.get("type") == "stop":
            await speechmatics.send(json.dumps({"message": "EndOfStream"}))
            return


async def _speechmatics_to_client(websocket, speechmatics):
    async for raw_message in speechmatics:
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            await _safe_send_json(websocket, {"type": "provider_raw", "message": raw_message})
            continue

        transcript = _extract_transcript(payload)
        if transcript:
            payload["transcript_text"] = transcript

        await _safe_send_json(websocket, payload)

        if payload.get("message") in {"EndOfTranscript", "Error"}:
            return


def _start_recognition(sample_rate, language, operating_point):
    return {
        "message": "StartRecognition",
        "audio_format": {
            "type": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": sample_rate,
        },
        "transcription_config": {
            "language": language,
            "operating_point": operating_point,
            "enable_partials": True,
        },
    }


def _speechmatics_url(api_key):
    base_url = os.getenv("SPEECHMATICS_RT_URL", SPEECHMATICS_DEFAULT_RT_URL).rstrip()
    separator = "&" if "?" in base_url else "?"
    query_param = os.getenv("SPEECHMATICS_AUTH_QUERY", "jwt")
    return f"{base_url}{separator}{urlencode({query_param: api_key}, quote_via=quote)}"


def _speechmatics_access_token(api_key):
    if os.getenv("SPEECHMATICS_USE_API_KEY_DIRECT", "").lower() in {"1", "true", "yes"}:
        return api_key

    ttl = _safe_int(os.getenv("SPEECHMATICS_JWT_TTL_SECONDS"), 60)
    ttl = max(60, min(ttl, 3600))
    management_url = os.getenv("SPEECHMATICS_MP_URL", "https://mp.speechmatics.com").rstrip("/")
    response = requests.post(
        f"{management_url}/v1/api_keys",
        params={"type": "rt"},
        json={"ttl": ttl},
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=(2, 6),
    )
    response.raise_for_status()
    payload = response.json()
    token = payload.get("key_value") or payload.get("jwt") or payload.get("key")

    if not token:
        raise RuntimeError("Speechmatics realtime JWT response did not include a token.")

    return token


def _extract_transcript(payload):
    metadata = payload.get("metadata") or {}
    metadata_transcript = metadata.get("transcript")
    if isinstance(metadata_transcript, str) and metadata_transcript.strip():
        return metadata_transcript.strip()

    results = payload.get("results")
    if not isinstance(results, list):
        return ""

    words = []
    for result in results:
        alternatives = result.get("alternatives") or []
        if alternatives:
            content = alternatives[0].get("content")
            if content:
                words.append(content)

    return " ".join(words).strip()


def _safe_int(value, default):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


async def _safe_send_json(websocket, payload):
    try:
        await websocket.send_json(payload)
    except RuntimeError:
        return
