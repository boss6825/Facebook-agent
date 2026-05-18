# Facebook Graph API Agent

Facebook Graph API Agent is a draft-first Facebook publishing assistant. It lets a user describe a Facebook Page post or a Facebook comment, generates polished copy with Claude, shows the generated draft in the frontend for review, and publishes the approved text through the Meta Graph API.

The project has two apps:

- `Backend/`: FastAPI service that handles credential storage, intent parsing, Claude draft generation, task state, and Facebook Graph API publishing.
- `frontend/`: React + Vite app that provides the chat UI, draft review flow, setup modal, dashboard, and task history.

## What This Agent Does

The agent supports two main actions:

- Create and publish a Facebook Page post.
- Create and publish a comment on an existing Facebook post URL or Graph object ID.

The agent is intentionally draft-first. A user command does not immediately publish content from the main draft endpoint. The backend first generates a draft, the frontend displays the draft in an editable review card, and publishing only happens after the user clicks `Publish`.

There is also a backend `/chat` endpoint that can generate and publish in one server-side flow, but the current frontend uses the safer `/draft` plus `/draft/{task_id}/publish` flow.

## Tech Stack

Frontend:

- React 18
- Vite
- Browser `fetch`
- Local storage for frontend task history

Backend:

- Python
- FastAPI
- Uvicorn
- Pydantic
- HTTPX
- Anthropic Claude Messages API
- Meta Facebook Graph API

## Project Structure

```text
Facebook-agent/
+-- Backend/
|   +-- main.py              # FastAPI app, routes, task lifecycle
|   +-- llm.py               # Intent parsing and Claude draft generation
|   +-- facebook_api.py      # Graph API publishing helpers
|   +-- facebook_config.py   # Local Page credential storage helpers
|   +-- config.py            # .env loading and runtime settings
|   +-- requirements.txt     # Python dependencies
|   +-- README.md            # Backend-specific quick notes
+-- frontend/
|   +-- src/
|   |   +-- App.jsx          # Main app state, polling, draft/publish workflow
|   |   +-- api.js           # Frontend API client
|   |   +-- components/      # Chat, dashboard, history, credentials UI
|   +-- vite.config.js       # Vite dev server and /api proxy
|   +-- package.json         # Frontend scripts and dependencies
|   +-- index.html
+-- .gitignore
+-- README.md
```

## Prerequisites

Install these before running the project:

- Python 3.10 or newer
- Node.js 18 or newer
- npm
- An Anthropic API key
- A Facebook Page ID
- A Facebook Page access token with the permissions needed to post to the Page and comment through the Graph API

The exact Meta permissions depend on your app type, Page, review status, and Graph API version. For publishing Page posts and comments, make sure your Meta app and Page token are authorized for the relevant Page publishing and engagement permissions.

## Environment Variables

Create this file:

```text
Backend/.env
```

Example:

```env
# Required: used by Backend/llm.py to call Claude
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here

# Optional: defaults to claude-3-5-haiku-latest
ANTHROPIC_MODEL=claude-3-5-haiku-latest

# Optional: defaults to v24.0
FACEBOOK_GRAPH_VERSION=v24.0

# Optional: used to generate appsecret_proof for Graph API calls
# You can also provide this through the frontend credential modal per saved config.
FACEBOOK_APP_SECRET=your_meta_app_secret_here
```

Do not commit `.env` files or access tokens. `.env` and `Backend/storage/` are ignored by git.

## Facebook Credentials

The frontend setup modal asks for:

- `Page ID`
- `Page Access Token`

These are sent to:

```text
POST /auth/credentials
```

The backend stores them locally in:

```text
Backend/storage/facebook_config.json
```

That file is local runtime state and should stay out of git. Clicking `Disconnect Page Token` in the frontend calls `POST /auth/logout`, which deletes the stored credential file.

## Start The Backend

From the project root:

```bash
cd Backend
python -m venv venv
```

Activate the virtual environment on Windows PowerShell:

```powershell
venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `Backend/.env` using the example above, then start the backend:

```bash
uvicorn main:app --reload --port 8000
```

Backend URL:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

Expected response:

```json
{
  "ok": true
}
```

## Start The Frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

The Vite dev server proxies frontend `/api/*` requests to the backend at `http://localhost:8000`.

Proxy config:

```js
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/api/, ''),
    },
  },
}
```

Because of this proxy, the frontend calls `/api/health`, and Vite forwards it to `http://localhost:8000/health`.

## Running The Full App

1. Start the backend on port `8000`.
2. Start the frontend on port `5173`.
3. Open `http://localhost:5173`.
4. The app checks backend health with `GET /health`.
5. The app checks setup state with `GET /status/setup`.
6. If credentials are missing, the Facebook setup modal opens.
7. Enter the Facebook Page ID and Page access token.
8. Use the Chat screen to create a post or comment draft.
9. Review and edit the generated draft.
10. Click `Publish` to send it to Facebook through the Graph API.

## Frontend Functionality

The frontend has three main screens:

- `Chat`: Main command interface. Supports normal post commands and a dedicated comment-by-link mode.
- `Dashboard`: Shows total commands, successful tasks, failed tasks, active tasks, and recent activity.
- `History`: Shows all locally tracked tasks with filters for all, completed, failed, and active tasks.

The frontend stores task history in browser local storage under:

```text
fb_agent_tasks
```

This means task history is local to the browser. Clearing browser storage removes the displayed history.

## Backend Functionality

The backend manages:

- Loading environment variables from `Backend/.env`.
- Saving and clearing Facebook Page credentials.
- Checking whether credentials are configured.
- Creating draft tasks.
- Parsing whether the user wants a post or comment.
- Calling Claude to generate text.
- Publishing approved text to Facebook.
- Keeping task state in memory.

Important limitation: backend tasks are stored in an in-memory Python dictionary. Restarting the backend clears task state. The frontend may still show local task history, but old task IDs will no longer be available from `GET /task/{task_id}` after a backend restart.

## API Endpoints

### `GET /health`

Checks whether the backend is running.

Response:

```json
{
  "ok": true
}
```

### `GET /status/setup`

Checks whether Facebook Page credentials are saved.

Response:

```json
{
  "credentials_saved": true,
  "credentials_valid": true,
  "session_active": false,
  "mode": "graph_api"
}
```

### `POST /auth/credentials`

Saves the Facebook Page ID and Page access token.

Request:

```json
{
  "page_id": "123456789012345",
  "page_access_token": "EAAB..."
}
```

Response:

```json
{
  "ok": true,
  "mode": "graph_api"
}
```

### `POST /auth/logout`

Deletes locally saved Facebook credentials.

Response:

```json
{
  "ok": true
}
```

### `POST /draft`

Creates a draft task. The backend starts draft generation in a background task and immediately returns a task ID.

Post command request:

```json
{
  "task_id": "optional-client-generated-id",
  "message": "Post about AI trends on Facebook"
}
```

Structured comment request:

```json
{
  "task_id": "optional-client-generated-id",
  "action": "comment",
  "target_url": "https://www.facebook.com/some-page/posts/123456789",
  "content_brief": "Great insight, thanks for sharing.",
  "message": "Comment on the target post saying: Great insight, thanks for sharing."
}
```

Initial response:

```json
{
  "task_id": "task-id",
  "status": "processing"
}
```

### `GET /task/{task_id}`

Returns the current task state.

Draft response example:

```json
{
  "id": "task-id",
  "status": "draft",
  "action": "post",
  "content_brief": "AI trends on Facebook",
  "generated_content": "Generated Facebook post text..."
}
```

Published response example:

```json
{
  "id": "task-id",
  "status": "done",
  "action": "post",
  "generated_content": "Published text...",
  "result": "Post published via Graph API. Post ID: 123456789_987654321",
  "graph_response": {
    "id": "123456789_987654321"
  }
}
```

### `POST /draft/{task_id}/publish`

Publishes an approved draft.

Request:

```json
{
  "text": "Final edited text to publish"
}
```

Initial response:

```json
{
  "task_id": "task-id",
  "status": "publishing"
}
```

The frontend then polls `GET /task/{task_id}` until the task becomes `done` or `error`.

### `POST /chat`

Creates a task, generates content, and publishes it in one backend flow.

Request:

```json
{
  "message": "Post about AI trends on Facebook"
}
```

The current frontend does not use this endpoint for the main user workflow because it skips manual draft approval.

## Agent Workflow

### Draft-first post flow

1. User enters a command in the frontend, for example:

   ```text
   Post about AI trends on Facebook
   ```

2. Frontend creates a local `task_id`.
3. Frontend calls:

   ```text
   POST /api/draft
   ```

4. Vite rewrites `/api/draft` to backend `/draft`.
5. Backend stores a task with status `processing`.
6. Backend runs `_create_draft_task` in the background.
7. Backend resolves intent:

   - If `action` is provided, it uses that explicit action.
   - If no `action` is provided, `llm.py` uses lightweight parsing to infer `post` or `comment`.

8. Backend calls Claude through `generate_post_text`.
9. Claude returns the generated post copy.
10. Backend updates the task to status `draft`.
11. Frontend polls:

    ```text
    GET /api/task/{task_id}
    ```

12. Frontend receives the draft and displays an editable review card.
13. User edits or accepts the text.
14. User clicks `Publish`.
15. Frontend calls:

    ```text
    POST /api/draft/{task_id}/publish
    ```

16. Backend updates the task to `publishing`.
17. Backend loads saved Facebook credentials from `Backend/storage/facebook_config.json`.
18. Backend calls:

    ```text
    POST https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}/{page_id}/feed
    ```

19. Facebook returns a Graph API response.
20. Backend marks the task as `done` or `error`.
21. Frontend polling sees the final status and updates Chat, Dashboard, and History.

### Draft-first comment flow

1. User switches to `Comment by Link`.
2. User enters a Facebook post URL and comment brief.
3. Frontend validates that the URL is from `facebook.com` or `fb.watch`.
4. Frontend sends a structured payload:

   ```json
   {
     "action": "comment",
     "target_url": "https://www.facebook.com/example/posts/123",
     "content_brief": "Great insight, thanks for sharing."
   }
   ```

5. Backend generates a concise comment with Claude.
6. Frontend displays the editable comment draft.
7. User clicks `Publish`.
8. Backend extracts a Graph object ID from the target URL.
9. Backend calls:

   ```text
   POST https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}/{object_id}/comments
   ```

10. Backend marks the task as `done` or `error`.

## Facebook URL And Object ID Handling

For comments, the backend tries to resolve the target Graph object ID from:

- Raw numeric object IDs
- Raw IDs with an underscore, such as `pageid_postid`
- URLs with `story_fbid` and `id`
- URLs with `fbid`
- URLs with `v`
- URL path segments like `posts/{id}`, `videos/{id}`, `reel/{id}`, or `permalink/{id}`
- `pfbid...` style path IDs

If the backend cannot resolve an object ID, publishing fails with an error asking for a URL that contains `story_fbid`, `fbid`, or a raw Graph post ID.

## Example Commands

Post examples:

```text
Post about AI trends on Facebook
```

```text
Write a post announcing our new product launch next week
```

```text
Create a post about why small businesses should automate customer support
```

Comment examples:

```text
Comment on https://www.facebook.com/zuck/posts/10102577175875681 saying Great insight, thanks for sharing.
```

Or use the frontend `Comment by Link` mode:

```text
URL: https://www.facebook.com/example/posts/123456789
Brief: Congratulate them and keep it friendly.
```

## Configuration Details

### Anthropic

`Backend/llm.py` calls:

```text
https://api.anthropic.com/v1/messages
```

It sends:

- `model`: from `ANTHROPIC_MODEL`
- `max_tokens`: `500` for posts, `220` for comments
- `temperature`: `0.7`

If `ANTHROPIC_API_KEY` is missing, draft generation fails with:

```text
ANTHROPIC_API_KEY is missing. Add it to Backend/.env.
```

### Facebook Graph API

`Backend/facebook_api.py` publishes Page posts with:

```text
/{page_id}/feed
```

It publishes comments with:

```text
/{object_id}/comments
```

The access token is sent as a query parameter. If an app secret is configured, the backend also sends `appsecret_proof`.

## Common Errors

### Backend is offline

The frontend shows this when `GET /api/health` fails.

Fix:

```bash
cd Backend
uvicorn main:app --reload --port 8000
```

### Please connect your Facebook account first

The backend is running, but `GET /status/setup` says credentials are missing.

Fix:

- Open the setup modal.
- Enter Page ID and Page access token.
- Save credentials.

### `ANTHROPIC_API_KEY is missing`

The backend cannot call Claude.

Fix:

- Create `Backend/.env`.
- Add `ANTHROPIC_API_KEY`.
- Restart the backend.

### Graph API permission error

The Page token may not have the required Page permissions, may be expired, or may not belong to the target Page.

Fix:

- Generate a valid Page access token.
- Confirm the Page ID is correct.
- Confirm the Meta app has the required permissions.
- Confirm the token can post to the target Page through Graph API Explorer or your Meta app tooling.

### Could not resolve a Graph object ID

The comment URL does not contain a resolvable Facebook object ID.

Fix:

- Use a URL containing `story_fbid`, `fbid`, or a clear `/posts/{id}` path.
- Or pass the raw Graph object ID.

## Development Notes

- Frontend API calls live in `frontend/src/api.js`.
- The frontend uses `/api` as its base URL.
- The backend allows CORS for `http://localhost:5173` and `http://127.0.0.1:5173`.
- The backend task store is in memory and is not durable.
- Facebook credentials are stored on disk in `Backend/storage/facebook_config.json`.
- The frontend task history is stored in browser local storage.

## Production Considerations

Before deploying this beyond local development, update these areas:

- Replace local JSON credential storage with encrypted secret storage or a database.
- Add real authentication for users.
- Do not expose Page tokens to untrusted clients.
- Use durable task storage instead of an in-memory dictionary.
- Add rate limiting and audit logging.
- Validate Meta permissions and token expiry explicitly.
- Restrict CORS to the production frontend origin.
- Consider a queue worker for background publishing tasks.
- Add tests for intent parsing, URL object ID extraction, and Graph API error handling.

## Build Commands

Frontend production build:

```bash
cd frontend
npm run build
```

Preview the built frontend:

```bash
cd frontend
npm run preview
```

Backend development server:

```bash
cd Backend
uvicorn main:app --reload --port 8000
```

## Quick Start

Terminal 1:

```bash
cd Backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```
