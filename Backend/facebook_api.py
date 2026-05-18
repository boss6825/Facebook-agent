import hashlib
import hmac
from urllib.parse import parse_qs, urlparse

import httpx

from config import FACEBOOK_GRAPH_VERSION
from facebook_config import FacebookConfig


class FacebookAPIError(RuntimeError):
    pass


def publish_page_post(config: FacebookConfig, message: str) -> dict:
    return _graph_post(config, f"/{config.page_id}/feed", {"message": message})


def publish_comment(config: FacebookConfig, target_url: str, message: str) -> dict:
    object_id = extract_facebook_object_id(target_url)
    if not object_id:
        raise FacebookAPIError(
            "Could not resolve a Graph object ID from that URL. Use a Facebook URL containing "
            "story_fbid/fbid or pass the raw Graph post ID."
        )
    return _graph_post(config, f"/{object_id}/comments", {"message": message})


def extract_facebook_object_id(raw: str | None) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None

    if _looks_like_object_id(value):
        return value

    if not value.lower().startswith(("http://", "https://")):
        return None

    parsed = urlparse(value)
    host = parsed.hostname or ""
    if "facebook.com" not in host and "fb.watch" not in host:
        return None

    query = parse_qs(parsed.query)
    story_fbid = _first(query, "story_fbid")
    owner_id = _first(query, "id")
    if story_fbid and owner_id:
        return f"{owner_id}_{story_fbid}"
    if story_fbid:
        return story_fbid

    for key in ("fbid", "v"):
        found = _first(query, key)
        if found:
            return found

    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        return None

    for marker in ("posts", "videos", "reel", "permalink"):
        if marker in parts:
            index = parts.index(marker)
            if len(parts) > index + 1:
                candidate = parts[index + 1]
                if _looks_like_path_id(candidate):
                    return candidate

    candidate = parts[-1]
    return candidate if _looks_like_path_id(candidate) else None


def _graph_post(config: FacebookConfig, path: str, data: dict) -> dict:
    url = f"https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}{path}"
    params = {"access_token": config.page_access_token}
    proof = _appsecret_proof(config.page_access_token, config.app_secret)
    if proof:
        params["appsecret_proof"] = proof

    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(url, params=params, data=data)
    except httpx.HTTPError as exc:
        raise FacebookAPIError(f"Graph API request failed: {exc}") from exc

    if response.status_code >= 400:
        raise FacebookAPIError(f"Graph API error ({response.status_code}): {_error_detail(response)}")

    return response.json()


def _appsecret_proof(access_token: str, app_secret: str) -> str | None:
    if not app_secret:
        return None
    digest = hmac.new(
        app_secret.encode("utf-8"),
        msg=access_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return digest


def _first(query: dict[str, list[str]], key: str) -> str | None:
    values = query.get(key) or []
    return values[0] if values else None


def _looks_like_object_id(value: str) -> bool:
    return value.isdigit() or bool(value.replace("_", "").isdigit() and "_" in value)


def _looks_like_path_id(value: str) -> bool:
    return value.isdigit() or value.startswith("pfbid")


def _error_detail(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:500]
    error = data.get("error") or {}
    message = error.get("message")
    code = error.get("code")
    fbtrace_id = error.get("fbtrace_id")
    parts = [message or str(data)[:500]]
    if code:
        parts.append(f"code={code}")
    if fbtrace_id:
        parts.append(f"fbtrace_id={fbtrace_id}")
    return " ".join(parts)
