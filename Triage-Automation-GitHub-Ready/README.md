# Workflow Automation Engine (DAG Automation Platform)

> A lightweight, self-hosted, visual workflow automation engine inspired by n8n — built from scratch with a custom Directed Acyclic Graph (DAG) topological execution walker, pluggable multi-step node system, Fernet-encrypted credential storage, HMAC-authenticated webhook triggers, and a modern React Flow visual canvas.

---

```
                               ┌────────────────────────────────────────┐
                               │   React Flow Canvas (Visual Builder)   │
                               └───────────────────┬────────────────────┘
                                                   │ (REST API / X-API-Key)
                                                   ▼
┌──────────────────────┐       ┌────────────────────────────────────────┐
│  Inbound Webhooks    │──────▶│         Flask REST API Layer           │
│ (HMAC-SHA256 Verified│       │   (/workflows, /runs, /credentials)    │
└──────────────────────┘       └───────────────────┬────────────────────┘
                                                   │
                                                   ▼
                               ┌────────────────────────────────────────┐
                               │        DAG Execution Engine            │
                               │  - Kahn's Algo Topological Sort        │
                               │  - Dependency Branch-Skipping Walker   │
                               │  - Template Engine ({{trigger.field}}) │
                               │  - Error Policies (Retry/Continue/Fail)│
                               └───────────────────┬────────────────────┘
                                                   │
                ┌──────────────────────────────────┴──────────────────────────────────┐
                ▼                                                                     ▼
┌───────────────────────────────┐                                     ┌───────────────────────────────┐
│     Pluggable Node Engine     │                                     │     Supabase / PostgreSQL     │
│ - HTTP Request (Auth Injected)│                                     │ - Workflow Definitions        │
│ - Conditional (Branching)     │                                     │ - Execution Runs & Node Logs  │
│ - Python Sandbox (Code)       │                                     │ - Fernet Encrypted Credentials│
│ - Delay (Sleep)               │                                     │ - Webhook Slugs & HMAC Secrets│
│ - LLM (Claude 3.5 Assistant)  │                                     └───────────────────────────────┘
└───────────────────────────────┘
```

---

## 🌟 Key Features

### 1. Custom DAG Topological Execution Engine
- **Topological Sorting:** Computes execution order upfront using **Kahn's Algorithm** with cycle detection (`CyclicGraphError`).
- **Conditional Branch-Skipping:** Dynamically traverses branches based on condition evaluation results (`true`/`false` paths), gracefully skipping untaken nodes.
- **Recursive Template Resolution:** Dynamically resolves template strings like `{{trigger.item_id}}` and `{{node_1.output.data.user.email}}` across nested objects and lists.
- **Configurable Error Policies:** Node-level error handling policies:
  - `fail`: Halts DAG execution and records failure details.
  - `continue`: Records node failure but allows independent downstream branches to continue.
  - `retry`: Retries execution with exponential backoff before reporting failure.

### 2. 5 Pluggable Node Types
- 🌐 **HTTP Request:** Makes external GET, POST, PUT, DELETE, and PATCH requests with JSON bodies, custom headers, and dynamic credential injection.
- 🔀 **Conditional:** Evaluates Python expressions (e.g. `{{trigger.score}} > 80`) to steer execution down `true` or `false` downstream edges.
- 🐍 **Code:** Executes sandboxed custom Python code snippets with `input_data` bindings (`trigger` and prior node outputs).
- ⏱️ **Delay:** Pauses execution for a specified duration in seconds.
- 🤖 **LLM (AI Assistant):** Calls Anthropic Claude models (`claude-3-5-haiku`, `claude-3-5-sonnet`, `claude-3-opus`) for automated analysis, triage, and summarization.

### 3. Visual Canvas & Node Configuration (React Flow)
- **Interactive DAG Canvas:** Infinite pan/zoom, interactive node dragging, edge connections, mini-map, and keyboard node/edge deletion.
- **Node Configuration Drawers:** Live configuration drawers for editing node parameters, test payloads, and error policies.
- **Real-Time Execution Status:** Live polling overlay with animated status rings (green = success, red = failed, gray = skipped) during workflow execution.

### 4. Encrypted Credential Store (Fernet AES-256)
- **Zero Plaintext Secrets in Workflows:** API keys, bearer tokens, and basic auth credentials are stored separately from workflow schemas.
- **Application-Layer Encryption:** Encrypted on write using symmetric Fernet encryption (`cryptography` library) and decrypted solely in-memory at node runtime.
- **Log Redaction Discipline:** Decrypted secrets are strictly masked (`[REDACTED]`) in `NodeExecutionLog` outputs, database records, and API responses.

### 5. Inbound Webhook Triggers
- **Public Ingestion Endpoint:** `POST /webhooks/<webhook_token>` allows external webhooks (GitHub, Stripe, custom backends) to trigger workflows.
- **HMAC-SHA256 Signature Verification:** Timing-safe `hmac.compare_digest()` verification via `X-Webhook-Signature` header.
- **Asynchronous Execution (`202 Accepted`):** Background thread execution returns immediately with a `run_id` without blocking external callers.
- **Security Protections:** 1MB payload size enforcement, in-memory sliding-window rate limiting (60 req/min), and generic 404 responses to prevent endpoint enumeration.

### 6. Execution Run History & Drill-Down Logs
- **Comprehensive History Dashboard:** Paginated list of historical workflow executions showing status, trigger type (`manual` / `webhook`), duration, and pass/fail metrics.
- **Detailed Execution Inspection:** Drill-down timeline showing individual node outputs, error stack traces, and execution timings.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11+, Flask 3.1, Pydantic 2.10, Pytest 8.3 |
| **Database** | Supabase (PostgreSQL with `pgcrypto` & JSONB) |
| **Security & Crypto** | Fernet (AES-128-CBC + HMAC-SHA256), timing-safe HMAC verification |
| **Frontend** | React 19, TypeScript, React Flow (`@xyflow/react`), Tailwind CSS, Vite |
| **AI Integration** | Anthropic SDK (`claude-3-5-haiku-20241022`) |

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) account

---

### Step 1: Clone and Configure Environment

```bash
git clone https://github.com/hmohammedmateenullashariff-bit/Triage-Automation-.git
cd Triage-Automation-
```

Copy the environment template:
```bash
cp .env.example .env
```

Generate a secure master Fernet encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Edit `.env` and fill in your keys:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
ANTHROPIC_API_KEY=your-anthropic-api-key
API_KEY=dev-api-key
CREDENTIAL_ENCRYPTION_KEY=<your-generated-fernet-key>
```

---

### Step 2: Set Up Database Schema

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor**.
3. Copy the contents of `schema.sql` and click **Run**.

---

### Step 3: Start the Backend API

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run test suite to verify installation
pytest tests/ -v

# Start the Flask API server (runs on http://localhost:5000)
flask --app app:create_app run --port 5000 --debug
```

---

### Step 4: Start the Frontend UI

```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173` to access the visual workflow canvas!

---

## 🧪 Running Automated Tests

The test suite covers the DAG engine, Kahn's algorithm, condition evaluations, credential encryption round-trips, webhook signature verifications, API routes, rate limiting, and log redactions:

```bash
pytest tests/ -v
```

**Test Coverage Summary:**
- `tests/test_executor.py`: Topological sorting, DAG cycle detection, conditional branching, retry/continue policies.
- `tests/test_nodes.py`: HTTP, Code, Delay, Conditional, and LLM nodes with template resolution and credential injection.
- `tests/test_credentials.py`: Credential encryption round-trip, CRUD API, and zero-exposure response assertions.
- `tests/test_webhooks.py`: Inbound webhook execution, HMAC-SHA256 signature verification, rate limiting, 1MB size limit.
- `tests/test_run_history.py`: Execution history pagination, duration calculation, and node count aggregations.
- `tests/test_routes.py`: Workflow creation, DAG validation, execution runs, and X-API-Key auth middleware.
- `tests/test_models.py`: Pydantic schema validators.

---

## 📸 Screenshots & Visual Tour

<!-- SCREENSHOT PLACEHOLDER: React Flow Canvas with 5 custom nodes connected in a DAG -->
> *Visual Workflow Builder Canvas with custom HTTP, LLM, Code, Delay, and Conditional branching nodes.*

<!-- SCREENSHOT PLACEHOLDER: Execution Overlay & Live Polling Status -->
> *Execution Status Overlay showing live node status rings and node execution logs.*

<!-- SCREENSHOT PLACEHOLDER: Credential Store & Webhook Manager -->
> *Encrypted Credential Manager and Inbound Webhook Configuration.*

---

## 🔮 Known Limitations & v2 Roadmap

- [ ] **Cron Triggers:** Scheduled background recurring workflow executions (deferred to v2).
- [ ] **Distributed Execution Queue:** Background threads currently handle webhook execution; v2 will integrate Celery/Redis for worker scaling.
- [ ] **Parallel DAG Walker:** Independent branches currently execute sequentially in topological order; v2 will resolve lazy parallel tasks.
- [ ] **OAuth 2.0 Connection Manager:** Direct OAuth token refresh flows for third-party SaaS integrations.
- [ ] **Distributed Rate Limiting:** Replace in-memory sliding-window limiter with Redis-backed token buckets for multi-instance deployments.

---

## 📄 License

MIT License. Built for portfolio demonstration and self-hosted automation exploration.
