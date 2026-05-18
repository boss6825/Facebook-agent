import json
from dataclasses import dataclass

from config import FACEBOOK_APP_SECRET, FACEBOOK_CONFIG_PATH, STORAGE_DIR


@dataclass
class FacebookConfig:
    page_id: str
    page_access_token: str
    app_secret: str = ""


def save_facebook_config(page_id: str, page_access_token: str, app_secret: str = "") -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "page_id": page_id.strip(),
        "page_access_token": page_access_token.strip(),
        "app_secret": app_secret.strip(),
    }
    FACEBOOK_CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_facebook_config() -> FacebookConfig | None:
    if not FACEBOOK_CONFIG_PATH.exists():
        return None

    try:
        data = json.loads(FACEBOOK_CONFIG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

    page_id = (data.get("page_id") or "").strip()
    page_access_token = (data.get("page_access_token") or "").strip()
    if not page_id or not page_access_token:
        return None

    return FacebookConfig(
        page_id=page_id,
        page_access_token=page_access_token,
        app_secret=(data.get("app_secret") or FACEBOOK_APP_SECRET or "").strip(),
    )


def clear_facebook_config() -> None:
    if FACEBOOK_CONFIG_PATH.exists():
        FACEBOOK_CONFIG_PATH.unlink()


def has_facebook_config() -> bool:
    return load_facebook_config() is not None
