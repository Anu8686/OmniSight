# OmniSight — AI-Powered Visual QA & Self-Healing Agent

OmniSight opens a website in a real Chromium browser, captures screenshots at desktop, tablet and mobile sizes, inspects the DOM and computed layout, detects visual defects (clipped buttons, overlaps, misalignment, wrapping navigation, low contrast), proposes a **scoped CSS fix**, and — only after a human approves — applies it in an **isolated workspace copy**, re-scans, and shows a before/after comparison.

It runs fully **without any paid API key**: with no vision model configured it uses deterministic rule-based checks and labels every result as *rule-based demo analysis*.

## Features

- Playwright scans: full-page + per-viewport screenshots, console errors, failed requests, sanitised DOM summary, bounding boxes.
- Analysis: deterministic geometry/contrast rules, plus an optional vision-language model (Anthropic or OpenAI) whose JSON output is validated against a strict Pydantic schema. Malformed output is rejected, never turned into invented findings.
- Self-healing: Plan → Analyze → Propose → Approve → Apply (isolated copy) → Re-scan → Evaluate → Report. Rollback and downloadable patch included.
- Issue management with filters, pagination, reviewer comments; scan reports with JSON/CSV export.
- GitHub: branch + commit + pull request after explicit approval. **Simulated mode** (clearly labelled) when no token is configured.
- Security: SSRF guard (blocks localhost/private/link-local/metadata, revalidates redirects), allow-listed scan hosts, CSS safelist for fixes, prompt-injection sanitising of page text, scrypt password hashing, httpOnly session cookie, rate limiting, audit log, secret masking.
- Next.js dashboard in the grey / blue / crimson brand palette.

## Architecture

```
Next.js (3000) ──cookie auth──▶ FastAPI (8000) ──▶ SQLite / PostgreSQL
                                   │  ├─ browser/   Playwright scanner + DOM probe
                                   │  ├─ ai/        rules + VLM providers + schema validation
                                   │  ├─ services/  scans, fixes (isolated workspaces), reports
                                   │  ├─ github/    REST client, simulated mode
                                   │  └─ security/  URL guard, CSS guard, rate limit
                                   ▼
                      data/screenshots, data/workspaces (files, not DB blobs)
demo-site/ (5050): deliberately buggy sample site used as the scan target
```

## Folder structure

```
omnisight/
  frontend/    Next.js App Router, TypeScript, Tailwind, Recharts, RHF + Zod
  backend/     FastAPI app (app/api, core, db, models, schemas, services, browser, ai, github, security) + tests/
  demo-site/   index.html, styles.css, script.js, serve.py
  screenshots/ docs/
```

## Prerequisites

Python 3.11+, Node.js 20+, Git. Chromium is installed through Playwright.

## Windows setup (CMD)

```bat
cd omnisight\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
copy .env.example .env
```

Start the three processes in three CMD windows:

```bat
:: 1) demo target site (http://127.0.0.1:5050)
cd omnisight\demo-site
python serve.py

:: 2) backend API (http://localhost:8000, docs at /docs)
cd omnisight\backend
.venv\Scripts\activate
python -m uvicorn app.main:app --port 8000

:: 3) frontend (http://localhost:3000)
cd omnisight\frontend
copy .env.example .env.local
npm install
npm run dev
```

The backend can also start the demo site itself when you create the demo project.

## Using the demo

1. Open http://localhost:3000, register (password: 10+ characters with a letter and a number), then use **Create demo project** (or "Run the guided demo" on Self-healing).
2. Run a scan. Watch stage and progress; screenshots and findings appear in the report.
3. Open an issue → **Propose fix** → review the diff → **Approve** → **Apply** → **Verify**.
4. Compare before/after screenshots. Optionally preview and create a (simulated) pull request on Integrations.

The demo site has four planted bugs (mobile checkout button overflow, misaligned card, wrapping nav, overlapping validation text) and a correct control section that must produce no findings.

## Configuration

All variables live in `backend/.env` (never in the frontend). Everything is optional for the local demo.

| Variable | Needed for |
|---|---|
| `SECRET_KEY` | **Required in production.** Dev generates a temporary key. |
| `DATABASE_URL` | Default SQLite. PostgreSQL: `postgresql+psycopg://user:pass@host:5432/omnisight` and `pip install "psycopg[binary]"`. |
| `ALLOWED_SCAN_HOSTS` | Hosts you are authorised to scan (`host` or `host:port`). |
| `ALLOWED_SOURCE_ROOTS` | Folders whose files may be used as fix sources. |
| `AI_PROVIDER` / `AI_MODEL` + `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Live vision analysis. Use a vision-capable model your key can access. |
| `GITHUB_TOKEN` + `GITHUB_REPOSITORY` | Real pull requests. Fine-grained token with Contents and Pull requests read/write on one repo. Without them the flow is simulated. |

## Tests

```bat
cd omnisight\backend
python -m pytest -q
```

Covers health, auth, project CRUD and validation, URL security rules, AI schema validation, scan lifecycle, issue creation and filtering, fix approval/rejection, isolated apply and verification, GitHub failure handling, and Playwright end-to-end scans against the demo site. Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Known limitations

- Rule-based mode finds geometric and contrast problems only; it cannot judge "looks wrong" the way a vision model can.
- Automated fixes are CSS override blocks appended to a stylesheet; other source types yield a code suggestion or patch only.
- Authenticated sites, CAPTCHAs and bot-protected pages are not bypassed; such scans fail with a clear message.
- Scans run in-process background tasks (no distributed queue); a server restart marks running scans failed.
- Live VLM and live GitHub paths are covered by mocked-transport tests, not by runs against the real services.
- Dark mode is only partly polished. PDF export is intentionally not included.

## Future improvements

Job queue (Celery/RQ), more fix types (JSX/Tailwind), visual-diff scoring, scheduled scans, team roles, Alembic migrations.

## Screenshots

Captured from a real run: `docs/screenshots/app/` (landing, auth, dashboard, projects, scans, issues, self-healing, integrations, settings, mobile) and `docs/screenshots/demo-site-scan/` (the Playwright captures of the demo site at desktop, tablet and mobile).
