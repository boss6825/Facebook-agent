import hashlib
import html
import hmac
import re
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

import httpx

from config import FACEBOOK_GRAPH_VERSION
from facebook_config import FacebookConfig


class FacebookAPIError(RuntimeError):
    pass


CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MAX_GRAPH_MESSAGE_CHARS = 1000
FACEBOOK_URL_FIELDS = "og_object{id},id"


def publish_page_post(config: FacebookConfig, message: str) -> dict:
    return _graph_post(config, f"/{config.page_id}/feed", {"message": _clean_message(message)})


def publish_comment(config: FacebookConfig, target_url: str, message: str) -> dict:
    object_id = resolve_facebook_object_id(config, target_url)
    if not object_id:
        raise FacebookAPIError(
            "Could not resolve a Graph object ID from that URL. Use a Facebook URL containing "
            "story_fbid/fbid, use the post permalink, or pass the raw Graph post ID. "
            "Facebook share links may fail if Meta does not expose the underlying post to your token."
        )
    # A bare numeric ID (no underscore) hits the deprecated "singular statuses" endpoint.
    # Look it up via the Graph API to get the full {owner}_{post} compound ID.
    if "_" not in object_id and object_id.isdigit():
        compound_id = _lookup_compound_post_id(config, object_id)
        if compound_id:
            object_id = compound_id
    return _graph_post(config, f"/{object_id}/comments", {"message": _clean_message(message)})


def is_facebook_share_url(raw: str | None) -> bool:
    value = (raw or "").strip()
    if not value.lower().startswith(("http://", "https://")):
        return False

    parsed = urlparse(value)
    if not _is_allowed_facebook_host(parsed.hostname or ""):
        return False

    parts = [part.lower() for part in parsed.path.split("/") if part]
    return len(parts) >= 2 and parts[0] == "share"


def share_url_error() -> str:
    return _share_url_error()


def resolve_facebook_object_id(config: FacebookConfig, raw: str | None) -> str | None:
    direct_id = extract_facebook_object_id(raw)
    if direct_id:
        return direct_id

    value = (raw or "").strip()
    if not _is_allowed_facebook_url(value):
        return None

    graph_id = _resolve_graph_url_object_id(config, value)
    if graph_id:
        return graph_id

    redirected_id = _resolve_redirect_object_id(value)
    if redirected_id:
        return redirected_id

    return None


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
    if not _is_allowed_facebook_host(host):
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


def _resolve_graph_url_object_id(config: FacebookConfig, target_url: str) -> str | None:
    url = f"https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}/"
    params = {
        "id": target_url,
        "fields": FACEBOOK_URL_FIELDS,
        "access_token": config.page_access_token,
    }
    proof = _appsecret_proof(config.page_access_token, config.app_secret)
    if proof:
        params["appsecret_proof"] = proof

    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            response = client.get(url, params=params)
    except httpx.HTTPError:
        return None

    if response.status_code >= 400:
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    og_object = data.get("og_object") or {}
    object_id = str(og_object.get("id") or "").strip()
    if _looks_like_object_id(object_id):
        return object_id

    direct_id = str(data.get("id") or "").strip()
    return direct_id if _looks_like_object_id(direct_id) else None


def _resolve_redirect_object_id(target_url: str) -> str | None:
    for candidate_url in _facebook_url_variants(target_url):
        object_id = _resolve_one_redirect_object_id(candidate_url)
        if object_id:
            return object_id
    return None


def _resolve_one_redirect_object_id(target_url: str) -> str | None:
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            response = client.get(
                target_url,
                headers={
                    "user-agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/125.0.0.0 Safari/537.36"
                    ),
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "en-US,en;q=0.9",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                },
            )
    except httpx.HTTPError:
        return None

    # Prefer numeric IDs from HTML (canonical/og:url) over pfbid slugs from URL hops
    content_type = response.headers.get("content-type", "")
    if "text/html" in content_type.lower():
        html_text = response.text[:500_000]
        hidden_id = _extract_object_id_from_html(html_text)
        if hidden_id:
            return hidden_id

        for candidate_url in _extract_canonical_urls(html_text):
            candidate_id = extract_facebook_object_id(candidate_url)
            if candidate_id:
                return candidate_id

    # Fall back to IDs extracted from redirect hop URLs
    for hop in [*response.history, response]:
        hop_id = extract_facebook_object_id(str(hop.url))
        if hop_id:
            return hop_id
        location = hop.headers.get("location")
        if location:
            location_id = extract_facebook_object_id(urljoin(str(hop.url), location))
            if location_id:
                return location_id

    return None


def _lookup_compound_post_id(config: FacebookConfig, bare_id: str) -> str | None:
    """Look up a bare post ID via Graph API to get the {owner}_{post} compound form."""
    url = f"https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}/{bare_id}"
    params = {"fields": "id", "access_token": config.page_access_token}
    proof = _appsecret_proof(config.page_access_token, config.app_secret)
    if proof:
        params["appsecret_proof"] = proof
    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(url, params=params)
    except httpx.HTTPError:
        return None
    if response.status_code >= 400:
        return None
    try:
        data = response.json()
    except ValueError:
        return None
    graph_id = (data.get("id") or "").strip()
    return graph_id if "_" in graph_id else None


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


def _is_allowed_facebook_host(host: str) -> bool:
    normalized = host.lower().strip(".")
    return (
        normalized == "facebook.com"
        or normalized.endswith(".facebook.com")
        or normalized == "fb.watch"
        or normalized.endswith(".fb.watch")
    )


def _is_allowed_facebook_url(raw: str) -> bool:
    if not raw.lower().startswith(("http://", "https://")):
        return False
    parsed = urlparse(raw)
    return _is_allowed_facebook_host(parsed.hostname or "")


def _share_url_error() -> str:
    return (
        "Facebook share links like /share/p/... hide the real Graph post ID and cannot be "
        "used reliably for commenting. Open the post in Facebook, copy the timestamp/permalink "
        "URL that contains story_fbid/fbid or /posts/{id}, or paste the raw Graph post ID."
    )


def _extract_canonical_urls(html_text: str) -> list[str]:
    urls = []
    for tag in re.findall(r"<(?:meta|link)\b[^>]*>", html_text, re.IGNORECASE):
        attrs = dict(
            (name.lower(), html.unescape(value))
            for name, value in re.findall(r'([a-zA-Z_:.-]+)=["\']([^"\']+)["\']', tag)
        )
        if attrs.get("property", "").lower() == "og:url" and attrs.get("content"):
            urls.append(attrs["content"])
        if attrs.get("rel", "").lower() == "canonical" and attrs.get("href"):
            urls.append(attrs["href"])

    for match in re.findall(r"https?:\\?/\\?/(?:www\.|m\.|mbasic\.)?facebook\.com[^\"'<>\\\s]+", html_text):
        urls.append(html.unescape(match).replace("\\/", "/"))

    return urls


def _extract_object_id_from_html(html_text: str) -> str | None:
    text = html.unescape(html_text).replace("\\/", "/")

    for candidate_url in _extract_canonical_urls(text):
        candidate_id = extract_facebook_object_id(candidate_url)
        if candidate_id:
            return candidate_id

    story_id = _first_regex_value(
        text,
        (
            r'["\']story_fbid["\']\s*:\s*["\']?([0-9]+)',
            r"[?&]story_fbid=([0-9]+)",
            r'["\']post_id["\']\s*:\s*["\']?([0-9]+)',
            r'["\']legacy_fbid["\']\s*:\s*["\']?([0-9]+)',
            r'["\']ft_ent_identifier["\']\s*:\s*["\']?([0-9]+)',
            r"[?&]ft_ent_identifier=([0-9]+)",
        ),
    )
    owner_id = _first_regex_value(
        text,
        (
            r'["\']content_owner_id_new["\']\s*:\s*["\']?([0-9]+)',
            r'["\']owning_profile_id["\']\s*:\s*["\']?([0-9]+)',
            r'["\']actorID["\']\s*:\s*["\']?([0-9]+)',
            r"[?&]id=([0-9]+)",
        ),
    )
    if story_id and owner_id:
        return f"{owner_id}_{story_id}"
    return story_id


def _first_regex_value(text: str, patterns: tuple[str, ...]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def _facebook_url_variants(raw: str) -> list[str]:
    parsed = urlparse(raw)
    if not parsed.hostname:
        return [raw]

    hosts = ["www.facebook.com", "m.facebook.com", "mbasic.facebook.com"]
    variants = [raw]
    for host in hosts:
        variant = urlunparse(parsed._replace(netloc=host))
        if variant not in variants:
            variants.append(variant)
    return variants


def _clean_message(message: str) -> str:
    text = CONTROL_CHARS_RE.sub("", (message or "")).strip()
    if not text:
        raise FacebookAPIError("Message cannot be empty.")
    if len(text) > MAX_GRAPH_MESSAGE_CHARS:
        raise FacebookAPIError(f"Message is too long. Keep it under {MAX_GRAPH_MESSAGE_CHARS} characters.")
    return text


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
