"""OpenRouter urban insight generation (PRD section 14). Strictly a
higher-level summarizer over structured aggregate data -- never the primary
detector. Optional -- degrades to "Urban insights unavailable." when
unconfigured or on failure, per PRD's own fallback rule."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger("uip.openrouter")

UNAVAILABLE_MESSAGE = "Urban insights unavailable. Core monitoring remains operational."


def is_available() -> bool:
    return bool(get_settings().openrouter_api_key)


async def generate_insight(aggregate: dict) -> str:
    settings = get_settings()
    if not settings.openrouter_api_key:
        return UNAVAILABLE_MESSAGE

    prompt = (
        "You are summarizing structured road-infrastructure monitoring data for a city "
        "transport operations team. Do not invent facts not present in the data below. "
        "Write two sentences, plain language, no markdown.\n\n"
        f"Data: {aggregate}"
    )

    try:
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                json={
                    "model": settings.openrouter_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("OpenRouter request failed (%s); degrading gracefully.", exc)
        return UNAVAILABLE_MESSAGE
