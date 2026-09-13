# HAVN Brain

> **Source of truth for AI coding agents working on HAVN.**
>
> Product branding is **HAVN** ("From Code to Cloud."). The repository/project directory and several internal package/code references still use **CloudForge**. Do not perform a global rename unless explicitly requested.

---

## 1. Project Identity

- **Current product name:** HAVN
- **Codebase / repository directory:** `cloudforge`
- **Tagline:** `From Code to Cloud.`
- **Product category:** Developer deployment platform / DevOps SaaS platform
- **Product inspiration:** Vercel, Railway, Render, Coolify
- **Core vision:** Allow developers to connect a Git repository, build container images, run asynchronous deployments, stream real-time build logs, and leverage an AI assistant to diagnose and resolve deployment failures.

HAVN is built as a portfolio-grade, production-style platform adhering to modern software engineering standards: strict resource isolation, database-backed atomic operations, complete authentication security, and clean separation of concerns.

---

## 2. Current Development Status

```text
Authentication (email/password + verification + rate limiting)   DONE
Account Security (email normalization, token hashing, TTLs)      DONE
Google OAuth Login (email_verified check + exchange code)        DONE
GitHub OAuth Login & Account Connection (isolated token storage) DONE
OAuth Security Hardening (DB-backed hashed state + 60s exchange) DONE
Project CRUD + PostgreSQL persistence                            DONE
GitHub Repository Listing & Branch Selection (paginated >100)    DONE
Project Deletion & Workspace / Artifact Cleanup                  DONE
Docker Build Engine (Buildx, progress=plain, image inspection)   DONE
Git Isolation (GIT_ASKPASS token injection, path traversal check)DONE
Deployment Pipeline (DB-backed queue, FOR UPDATE SKIP LOCKED)    DONE
Deployment Worker (heartbeats, lease recovery, cancellation)     DONE
Dashboard Real-Time Deployment & Log Streaming Modal             DONE
Developer Profile & Password Management                          DONE
Accessibility & UX Polish (form alerts, reduced motion, labels)  DONE
AI Deployment-Log Assistant (Beginner & Expert Modes)           UP NEXT (Phase 2)
Cloud Production Infrastructure (AWS EC2 / ECS / Kubernetes)     PLANNED
Prometheus & Grafana Telemetry Metrics                          PLANNED
Rollback to Previous Deployment                                  PLANNED
Custom Domains & Reverse Proxy (Traefik/Caddy)                   PLANNED
```

---

## 3. Technology Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Bundler / Dev Server:** Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **Icons:** Lucide React (`lucide-react`)
- **Animation & Motion:** GSAP, Motion (`motion`)
- **HTTP Client:** Axios (`src/services/api.ts` with dynamic Bearer token interceptor supporting `localStorage` & `sessionStorage`)
- **AI SDK:** `@google/genai` installed for Phase 2 AI Assistant

### Backend
- **Runtime:** Node.js (CommonJS, TypeScript via `ts-node-dev` and `tsc`)
- **Web Framework:** Express 5 (`express@^5.2.1`)
- **Database & ORM:** PostgreSQL with Prisma ORM 6.16.2 (`@prisma/client`, `prisma`)
- **Password Hashing:** `bcrypt` (10 rounds)
- **Token Management:** `jsonwebtoken` (dynamic expiry: 1d for session, 7d for persistent login)
- **Validation:** Zod 4 (`zod@^4.4.3`)
- **Email Delivery:** Resend (`resend@^6.20.0`)
- **Containerization:** Docker Engine & Buildx (`docker buildx build --load`)
- **Security & Utilities:** Node `crypto` (SHA-256 token hashing, AES token encryption), custom rate-limiting middleware, regex-based command/path sanitizers

---

## 4. Repository Structure

```text
cloudforge/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma           # 10 Prisma models & enums (Deployment, BuildLog, OAuth, etc.)
│   ├── scratch/
│   │   └── builds/                 # Root for isolated workspace checkouts (SCRATCH_ROOT_DIR)
│   ├── src/
│   │   ├── constants/              # Build constants, timeouts, regex validations
│   │   ├── controllers/            # auth, project, github, deployment, health
│   │   ├── lib/
│   │   │   └── prisma.ts           # PrismaClient singleton
│   │   ├── middleware/             # auth, validation, rateLimit middleware
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/               # auth, git, docker, deployment, worker, github, email
│   │   │   └── __tests__/          # Integration test suites for auth, git, docker, deployment
│   │   ├── utils/                  # jwt, sanitizer, crypto
│   │   ├── app.ts                  # Express application setup & middleware
│   │   └── server.ts               # HTTP listener + deployment worker bootstrap
│   ├── package.json
│   └── tsconfig.json
│
├── src/
│   ├── components/
│   │   ├── auth/                   # ProtectedRoute, etc.
│   │   ├── dashboard/              # BuildLogModal, ProjectCard, etc.
│   │   ├── landing/                # Hero, Features, Pricing, Faq
│   │   ├── layout/                 # Navbar, Footer
│   │   └── ui/                     # Shared UI components
│   ├── constants/                  # Routes, styling constants
│   ├── data/                       # Static copy & fallback types
│   ├── pages/                      # Login, Signup, Dashboard, Profile, OAuthCallback, etc.
│   ├── services/                   # api.ts, auth.service, project.service, deployment.service, github.service
│   ├── types/                      # TypeScript definitions (Project, Deployment, Logs, etc.)
│   ├── App.tsx                     # Route registration & layout shell
│   └── main.tsx                    # Application entry point
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── brain.md                        # Central project memory & source of truth
```

---

## 5. Runtime Architecture & Ports

- **Frontend Development Server:** `http://localhost:3000` (Vite)
- **Backend Development Server:** `http://localhost:5000` (Express)
- **API Base URL:** `http://localhost:5000/api`
- **Database:** PostgreSQL (configured via `DATABASE_URL`)
- **Docker Daemon:** Local Docker engine socket / daemon required for build execution

---

## 6. Database Architecture (`backend/prisma/schema.prisma`)

The database uses PostgreSQL with 10 models and 2 enums:

### Enums
1. **`DeploymentStatus`**: `QUEUED`, `INITIALIZING`, `BUILDING`, `BUILT`, `FAILED`, `CANCELLED`
2. **`LogStream`**: `STDOUT`, `STDERR`, `SYSTEM`

### Models
1. **`User`**: Account records. Supports `provider` ("credentials", "google", "github"), `email` (strictly unique, normalized), `emailVerified`, and cascade relations to tokens, projects, and connected accounts.
2. **`EmailVerificationToken`**: SHA-256 hashed verification tokens with 30-minute TTL.
3. **`PasswordResetToken`**: SHA-256 hashed password reset tokens with 15-minute TTL.
4. **`GithubAccount`**: Linked GitHub profile. Stores `githubUserId` (unique across users to prevent account takeover), `githubUsername`, `accessToken` (encrypted or scoped), and `scope`.
5. **`GithubOauthState`**: Temporary SHA-256 hashed state tokens for GitHub repository connect flows (10-minute TTL).
6. **`OAuthState`**: Generic provider state storage (`provider`, `stateHash`, `expiresAt`) for Google and GitHub login flows.
7. **`OAuthExchange`**: Short-lived (60s TTL) one-time exchange code storage for secure token handoff. Maps a cryptographically random code hash to an application JWT and user payload, preventing JWT exposure in browser query parameters.
8. **`Project`**: Core application project. Belongs to a `User`. Stores `name`, `repositoryName`, `repositoryUrl`, `branch`, and current `status` (`idle`, `queued`, `building`, `ready`, `failed`, `cancelled`).
9. **`Deployment`**: Execution record for a project build. Stores `workerId`, `heartbeatAt`, repository metadata, git commit details (`commitSha`, `commitMsg`, `commitAuthor`), Docker metadata (`imageTag`, `dockerfilePath`), execution timestamps (`startedAt`, `completedAt`, `durationMs`), `exitCode`, and sanitized `errorMessage`.
10. **`BuildLog`**: Granular log lines attached to a `Deployment`. Enforces ordering via sequential integer `sequence`, categorized by `stream` (`STDOUT`, `STDERR`, `SYSTEM`), with composite unique constraint `@@unique([deploymentId, sequence])`.

---

## 7. Completed System Modules & Verification

### Milestone 1: Authentication & Account Security
- **Email Normalization:** All auth endpoints (`register`, `login`, `forgotPassword`, Google OAuth, GitHub OAuth) strictly normalize emails via `trim().toLowerCase()`.
- **Password Security:** Salted hashing with `bcrypt` (10 rounds). Secure validation via Zod (minimum 8 characters, uppercase, lowercase, numbers).
- **Session Tokens:** JWT generation supports "Keep me signed in":
  - Unchecked: Token valid for 1 day (`1d`), stored in `sessionStorage`.
  - Checked: Token valid for 7 days (`7d`), stored in `localStorage`.
  - Axios interceptor checks both storages automatically.
- **Verification & Password Reset:** Tokens are cryptographically random 32-byte hex strings hashed using SHA-256 before database storage. Raw tokens are sent via Resend emails.
- **Rate Limiting (`backend/src/middleware/rateLimit.middleware.ts`):**
  - `/api/auth/forgot-password`: 5 req / 15m per IP; 3 req / 15m per email account (returns 200 generic message to prevent email enumeration).
  - `/api/auth/reset-password`: 10 req / 15m per IP.
  - `/api/auth/change-password`: 5 req / 15m per authenticated user / IP.
  - `/api/auth/test-email`: 3 req / 15m per IP; automatically returns `403 Forbidden` when `NODE_ENV === "production"`.

### Milestone 2: Hardened OAuth Implementation
- **Provider Login:** Google OAuth (with `email_verified: true` enforcement) and GitHub OAuth login.
- **State Validation:** Cryptographic state generated via `crypto.randomBytes(32).toString("hex")`, hashed with SHA-256, and stored in PostgreSQL `OAuthState` (10m TTL).
- **Atomic Single-Use State Consumption:** States are deleted in a single query (`deleteMany` where `count === 1`), eliminating replay and race conditions.
- **Secure Code Exchange (`OAuthExchange`):** Backend generates a short-lived random code (60s TTL), redirects the browser with `?code=<exchangeCode>`, and the frontend swaps it via `POST /api/auth/oauth/exchange`. Session JWTs never touch URL query strings or browser history.
- **Socket Timeouts:** Outbound provider HTTP requests enforce a 10s socket timeout (`timeout: 10000`).

### Milestone 3: Project Management & Git Integration
- **Project CRUD:** Scoped to the authenticated user (`POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`).
- **Validation:** Project names cannot be empty or solely whitespace.
- **GitHub Connection:** Separate flow for linking GitHub accounts to existing user profiles (`/api/github/connect`). Guarantees 1-to-1 mapping via unique `githubUserId`.
- **Repository & Branch Pagination:** Supports users with over 100 repositories via multi-page fetching (`per_page=100`, loops until exhaustive or ceiling reached).

### Milestone 4: Production-Grade Deployment Engine (Phases 1.1 - 1.6)
- **Phase 1.1 (Schema & Models):** `Deployment` and `BuildLog` models with complete status lifecycles.
- **Phase 1.2 (Git Security & Isolation):**
  - Isolated clone workspaces in `backend/scratch/builds/<deploymentId>`.
  - Repository URL validation using strict HTTPS regex (`GITHUB_REPO_URL_REGEX`).
  - Branch name dangerous character filtering (`BRANCH_DANGEROUS_CHARS_REGEX`).
  - Credential isolation using `GIT_ASKPASS` script + process-level child environment, preventing OAuth tokens from leaking to command lines or process tables.
  - Dockerfile path traversal verification ensuring build files stay within the cloned workspace.
  - Hard timeouts (120s for clone, 15s for git commands).
- **Phase 1.3 (Docker Build Engine):**
  - Built with `docker buildx build --load --progress=plain`.
  - Deployment-specific image tags (`cloudforge-dep-${deploymentId}:latest`).
  - Real-time stdout and stderr stream parsing.
  - Post-build image inspection (`docker image inspect`) verifying size does not exceed 2 GB limit.
  - Hard timeout (600s).
- **Phase 1.4 (Asynchronous Deployment Worker):**
  - Database-backed FIFO queue runner (`DeploymentWorker` in `backend/src/services/deployment.worker.ts`).
  - Atomic run claiming using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.
  - Worker heartbeats (`heartbeatAt`) renewed every 30 seconds.
  - Stale worker lease recovery for orphaned or crashed processes (>120s threshold).
  - Graceful stop handler (`stop()`) for clean test shutdown and SIGTERM signals.
  - Active build cancellation support via abort controllers and process tree termination.
- **Phase 1.5 (Deployment Orchestration & Project Sync):**
  - Queue limit policy: Maximum 1 active build and 1 queued build permitted per project under row-level lock. Submitting a third deployment while one is active and one is queued returns HTTP 409 Conflict.
  - Invariant Status Sync: An older deployment run can never overwrite a newer deployment run's project status.
  - Cascading cleanup: Deleting a project removes its workspace directory, deployment records, and Docker images.
  - Authorization: Strict scoping preventing users from viewing, deploying, or cancelling projects owned by others.
- **Phase 1.6 (Dashboard Integration):**
  - Connected to live backend deployment APIs.
  - Real-time build log streaming modal with polling (`/api/deployments/:id/logs?afterSequence=N`).
  - Accurate chronological sorting by real timestamps (`createdAt`).
  - Zero simulated/mock builds; genuine Docker engine orchestration.

### Milestone 5: Accessibility & UX Polish
- Accordion panels on FAQ properly manage accessibility tree visibility (`visible` / `invisible`).
- `prefers-reduced-motion` detection in canvas components disables requestAnimationFrame loops.
- Form controls include explicit labels, `autoComplete`, `required` attributes, and `role="alert"` live regions.
---

## 8. Verified Test Suites

The backend integration test suites are executed via `ts-node` under `backend/src/services/__tests__/`:
1. **`project.deployment.test.ts`**: 13/13 Phase 1.5 orchestration tests passed (project-scoped runs, isolation, cancellation, status sync, cascade delete).
2. **`deployment.pipeline.test.ts`**: Complete async build and worker drain loop tests passed.
3. **`docker.service.test.ts`**: Docker Buildx execution, stream parsing, and 2GB limit validation tests passed.
4. **`git.service.test.ts`**: Workspace isolation, credential masking via `GIT_ASKPASS`, and path traversal prevention tests passed.
5. **`oauth.state.test.ts`**: Cryptographic state generation, SHA-256 hashing, and single-use atomic consumption tests passed.
6. **`oauth.redirect.test.ts`**: OAuth URL construction and short-lived exchange code handling tests passed.
7. **`google.auth.test.ts`**: Google token verification and account linkage tests passed.
8. **`auth.normalization.test.ts`**: Unified email normalization (`trim().toLowerCase()`) tests passed across all flows.
9. **`github.pagination.test.ts`**: Multi-page repository fetching (>100 repos) tests passed.
10. **`testEmail.protection.test.ts`**: Production guard and rate limiting tests passed.
11. **`project.update.test.ts`**: Whitespace/empty project name validation tests passed.
12. **`worker.concurrency.test.ts`**: Single-active-run policy, concurrent `processNext()` lock blocking during `claimNextDeployment()`, and error recovery tests passed.

---

## 9. Next Milestone: Phase 2 AI Deployment Log Assistant (USP)

The flagship differentiator for HAVN is automated, context-aware deployment log diagnostics powered by Google Gemini (`@google/genai`).

### Architecture & Capabilities
1. **Log Stream Ingestion:** Directly ingest structured logs from `BuildLog` records for failed or stalled runs.
2. **Dual Perspective Analysis:**
   - **Beginner Mode:** Plain-English, conversational explanation addressing three core questions:
     - *What happened?*
     - *Why did it happen?*
     - *How do I fix it?*
   - **Expert Mode:** Precise root cause breakdown, exact log line citations, container runtime diagnostics, and copy-paste remediation commands.
3. **One-Click Remediation:** Intelligent recommendations to adjust `Dockerfile`, modify environment variables, or update build commands.

---

## 10. Environment Variable Reference

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# PostgreSQL Database
DATABASE_URL="postgresql://user:password@localhost:5432/cloudforge?schema=public"

# Authentication & Security
JWT_SECRET="your-secure-jwt-secret"
JWT_EXPIRES_IN="7d"

# Email Delivery (Resend)
RESEND_API_KEY="re_123456789"
EMAIL_FROM="HAVN <notifications@yourdomain.com>"

# Google OAuth
GOOGLE_CLIENT_ID="google-client-id"
GOOGLE_CLIENT_SECRET="google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

# GitHub OAuth
GITHUB_CLIENT_ID="github-client-id"
GITHUB_CLIENT_SECRET="github-client-secret"
GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"

# Token Encryption (AES-256-GCM: 64-char hex string representing 32 bytes, or raw 32-character UTF-8 string)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

> **Security Rule:** Never commit `.env` files or hardcode real API keys/credentials into the repository. Use `backend/.env.example` as the canonical template.

---

## 11. Engineering Guidelines for AI Agents

1. **Document Real Code Reality:** Never document simulated capabilities as real, and never describe real production engines as simulations. Docker build and deployment pipelines are fully implemented and verified.
2. **Maintain Architectural Hierarchy:** Respect the clean layering: `Route -> Controller -> Service -> Prisma`. Do not bypass services or create ad-hoc database connections.
3. **Strict Resource Isolation:** Always clean up temporary directories (`backend/scratch/builds/<deploymentId>`) and prune build container artifacts after build execution.
4. **Preserve User Ownership:** Enforce user authorization on all project, deployment, and repository interactions.
5. **Run Verification Before Completion:** Execute the relevant integration test suites before marking tasks complete.


