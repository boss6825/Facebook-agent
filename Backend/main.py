from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from facebook_api import FacebookAPIError, publish_comment, publish_page_post
from facebook_config import (
    clear_facebook_config,
    has_facebook_config,
    load_facebook_config,
    save_facebook_config,
)
from llm import LLMError, generate_comment_text, generate_post_text, parse_intent


app = FastAPI(title="Facebook Graph API Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


tasks: dict[str, dict] = {}
tasks_lock = Lock()


class SaveCredentialsRequest(BaseModel):
    page_id: str | None = Field(default=None, max_length=64)
    page_access_token: str | None = Field(default=None, max_length=4096)
    app_secret: str | None = Field(default=None, max_length=256)
    email: str | None = Field(default=None, max_length=64)
    password: str | None = Field(default=None, max_length=4096)


class DraftRequest(BaseModel):
    task_id: str | None = Field(default=None, max_length=80)
    message: str | None = Field(default=None, max_length=1500)
    action: str | None = Field(default=None, max_length=20)
    target_url: str | None = Field(default=None, max_length=500)
    content_brief: str | None = Field(default=None, max_length=1200)


class PublishRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/status/setup")
def setup_status() -> dict:
    configured = has_facebook_config()
    return {
        "credentials_saved": configured,
        "credentials_valid": configured,
        "session_active": False,
        "mode": "graph_api",
    }


@app.post("/auth/credentials")
def save_credentials(payload: SaveCredentialsRequest) -> dict:
    page_id = (payload.page_id or payload.email or "").strip()
    page_access_token = (payload.page_access_token or payload.password or "").strip()
    app_secret = (payload.app_secret or "").strip()

    if not page_id or not page_access_token:
        raise HTTPException(status_code=400, detail="Page ID and Page access token are required.")
    if not page_id.isdigit():
        raise HTTPException(status_code=400, detail="Page ID must contain only digits.")

    save_facebook_config(page_id, page_access_token, app_secret)
    return {"ok": True, "mode": "graph_api"}


@app.post("/auth/logout")
def logout() -> dict:
    clear_facebook_config()
    return {"ok": True}


@app.post("/draft")
def create_draft(payload: DraftRequest, background_tasks: BackgroundTasks) -> dict:
    task_id = payload.task_id or str(uuid4())
    _set_task(
        task_id,
        {
            "id": task_id,
            "status": "processing",
            "created_at": _now(),
            "message": payload.message,
            "action": payload.action,
            "target_url": payload.target_url,
        },
    )
    background_tasks.add_task(_create_draft_task, task_id, payload)
    return {"task_id": task_id, "status": "processing"}


@app.post("/draft/{task_id}/publish")
def publish_draft(task_id: str, payload: PublishRequest, background_tasks: BackgroundTasks) -> dict:
    task = _get_task_or_404(task_id)
    if task.get("status") != "draft":
        raise HTTPException(status_code=409, detail=f"Task is not ready to publish. Current status: {task.get('status')}")

    _merge_task(task_id, {"status": "publishing", "generated_content": payload.text})
    background_tasks.add_task(_publish_task, task_id, payload.text)
    return {"task_id": task_id, "status": "publishing"}


@app.post("/chat")
def chat(payload: DraftRequest, background_tasks: BackgroundTasks) -> dict:
    task_id = payload.task_id or str(uuid4())
    _set_task(
        task_id,
        {
            "id": task_id,
            "status": "processing",
            "created_at": _now(),
            "message": payload.message,
            "target_url": payload.target_url,
        },
    )
    background_tasks.add_task(_chat_task, task_id, payload)
    return {"task_id": task_id, "status": "processing"}


@app.get("/task/{task_id}")
def get_task(task_id: str) -> dict:
    return _get_task_or_404(task_id)


def _create_draft_task(task_id: str, payload: DraftRequest) -> None:
    try:
        intent = _resolve_intent(payload)
        if intent["action"] == "comment":
            generated = generate_comment_text(intent["content_brief"], intent.get("target_url"))
        else:
            generated = generate_post_text(intent["content_brief"])

        _merge_task(
            task_id,
            {
                "status": "draft",
                "action": intent["action"],
                "target_url": intent.get("target_url"),
                "content_brief": intent["content_brief"],
                "generated_content": generated,
                "updated_at": _now(),
            },
        )
    except (LLMError, ValueError) as exc:
        _merge_task(task_id, {"status": "error", "error": str(exc), "updated_at": _now()})


def _publish_task(task_id: str, text: str) -> None:
    try:
        config = load_facebook_config()
        if not config:
            raise FacebookAPIError("Facebook Page ID and Page access token are not configured.")

        task = _get_task_or_404(task_id)
        action = task.get("action") or "post"
        if action == "comment":
            response = publish_comment(config, task.get("target_url") or "", text)
            result = f"Comment published via Graph API. Comment ID: {response.get('id', 'unknown')}"
        else:
            response = publish_page_post(config, text)
            result = f"Post published via Graph API. Post ID: {response.get('id', 'unknown')}"

        _merge_task(
            task_id,
            {
                "status": "done",
                "result": result,
                "graph_response": response,
                "updated_at": _now(),
            },
        )
    except (FacebookAPIError, HTTPException) as exc:
        _merge_task(task_id, {"status": "error", "error": str(exc), "updated_at": _now()})


def _chat_task(task_id: str, payload: DraftRequest) -> None:
    _create_draft_task(task_id, payload)
    task = _get_task_or_404(task_id)
    if task.get("status") != "draft":
        return
    _merge_task(task_id, {"status": "publishing"})
    _publish_task(task_id, task.get("generated_content") or "")


def _resolve_intent(payload: DraftRequest) -> dict:
    action = (payload.action or "").strip().lower()
    if action:
        if action not in {"post", "comment"}:
            raise ValueError("Only post and comment actions are supported.")
        brief = (payload.content_brief or payload.message or "").strip()
        if not brief:
            raise ValueError("A content brief or message is required.")
        if action == "comment" and not (payload.target_url or "").strip():
            raise ValueError("A target Facebook post URL is required for comments.")
        return {
            "action": action,
            "content_brief": brief,
            "target_url": (payload.target_url or "").strip() or None,
        }

    intent = parse_intent(payload.message or "")
    return {
        "action": intent.action,
        "content_brief": intent.content_brief,
        "target_url": intent.target_url,
    }


def _set_task(task_id: str, task: dict) -> None:
    with tasks_lock:
        tasks[task_id] = task


def _merge_task(task_id: str, patch: dict) -> None:
    with tasks_lock:
        existing = tasks.get(task_id, {"id": task_id})
        tasks[task_id] = {**existing, **patch}


def _get_task_or_404(task_id: str) -> dict:
    with tasks_lock:
        task = tasks.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        return dict(task)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
