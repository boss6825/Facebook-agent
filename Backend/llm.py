import re
from dataclasses import dataclass

import httpx

from config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL


class LLMError(RuntimeError):
    pass


@dataclass
class Intent:
    action: str
    content_brief: str
    target_url: str | None = None


URL_RE = re.compile(r"https?://[^\s)>\]]+", re.IGNORECASE)


def parse_intent(message: str) -> Intent:
    text = (message or "").strip()
    if not text:
        raise LLMError("Message is required.")

    url_match = URL_RE.search(text)
    lowered = text.lower()
    if url_match and "comment" in lowered:
        target_url = url_match.group(0).rstrip(".,")
        brief = text[url_match.end() :].strip()
        brief = re.sub(r"^(saying|say|with|about)\s*:?\s*", "", brief, flags=re.IGNORECASE)
        if not brief:
            brief = text
        return Intent(action="comment", target_url=target_url, content_brief=brief)

    brief = re.sub(r"^\s*(post|create a post|write a post)\s+(about|on)?\s*", "", text, flags=re.IGNORECASE)
    return Intent(action="post", content_brief=brief or text)


def generate_post_text(brief: str) -> str:
    return _generate_text(
        "Write one polished Facebook page post from this brief.\n"
        "Keep it useful, specific, and natural. Avoid hashtags unless the brief asks for them. "
        "Return only the final post text.\n\n"
        f"Brief: {brief}"
    )


def generate_comment_text(brief: str, target_url: str | None = None) -> str:
    target_line = f"\nTarget post URL: {target_url}" if target_url else ""
    return _generate_text(
        "Write one concise Facebook comment from this brief. "
        "Sound human, relevant, and non-spammy. Return only the final comment text.\n\n"
        f"Brief: {brief}{target_line}",
        max_tokens=220,
    )


def _generate_text(prompt: str, max_tokens: int = 500) -> str:
    if not ANTHROPIC_API_KEY:
        raise LLMError("ANTHROPIC_API_KEY is missing. Add it to Backend/.env.")

    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=30) as client:
            response = client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise LLMError(f"Claude API request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = _error_detail(response)
        raise LLMError(f"Claude API error ({response.status_code}): {detail}")

    data = response.json()
    parts = []
    for block in data.get("content", []):
        if block.get("type") == "text":
            parts.append(block.get("text", ""))
    text = "\n".join(parts).strip()
    if not text:
        raise LLMError("Claude returned an empty draft.")
    return text


def _error_detail(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:500]
    error = data.get("error") or {}
    return error.get("message") or str(data)[:500]
