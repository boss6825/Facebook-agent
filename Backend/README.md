# Facebook Graph API Agent Backend

Minimal FastAPI backend for the existing draft-first frontend.

## Setup

Create `Backend/.env`:

```env
ANTHROPIC_API_KEY=your_anthropic_key
# Optional:
# ANTHROPIC_MODEL=claude-3-5-haiku-latest
# FACEBOOK_GRAPH_VERSION=v24.0
# FACEBOOK_APP_SECRET=your_meta_app_secret
```

Install and run:

```bash
cd Backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend setup modal stores:

- Facebook Page ID
- Facebook Page access token

Publishing uses:

- `POST /{page_id}/feed` for Page posts
- `POST /{object_id}/comments` for comments when the submitted URL contains a resolvable Graph object ID

The Page access token needs the relevant Meta permissions for the target Page, such as Page posting/comment permissions approved for your app.
