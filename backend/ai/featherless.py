import os

import requests


def call_llm(prompt: str, fallback=None):
    api_key = os.getenv("FEATHERLESS_API_KEY")
    model = os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen3-Coder-30B-A3B-Instruct")
    base_url = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1").rstrip("/")
    timeout_seconds = float(os.getenv("FEATHERLESS_TIMEOUT_SECONDS", "2.8"))

    if not api_key:
        return fallback or {
            "role": "Local Fallback",
            "verdict": "External LLM key is not configured.",
            "grounding": "No external model call was made.",
        }

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a concise software architecture and security reasoning agent. Ground every claim in the provided execution graph.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            },
            timeout=(1.5, timeout_seconds),
        )
        response.raise_for_status()
        payload = response.json()
        content = _extract_chat_content(payload)

        if fallback is not None:
            enriched = dict(fallback)
            enriched["llm_status"] = "live"
            enriched["llm_provider"] = "featherless"
            enriched["llm_model"] = model
            enriched["llm_output"] = content
            return enriched

        return {
            "role": "Featherless Inference",
            "verdict": content,
            "llm_status": "live",
            "llm_provider": "featherless",
            "llm_model": model,
        }
    except requests.RequestException as exc:
        if fallback is not None:
            fallback = dict(fallback)
            fallback["llm_status"] = f"External LLM unavailable: {exc.__class__.__name__}"
            return fallback

        return {
            "role": "Local Fallback",
            "verdict": "External LLM call failed.",
            "error": exc.__class__.__name__,
        }


def _extract_chat_content(payload):
    choices = payload.get("choices") or []
    if not choices:
        return "Featherless returned no choices."

    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()

    return str(content or "").strip() or "Featherless returned an empty message."
