# PHASE.md - Dispatra Production Roadmap

Dispatra is an on-chain delivery escrow platform on Monad. This document tracks the
phased build from hackathon prototype to production SaaS.

**Current phase:** Phase 4 (Auth + KYC)

---

## Decisions Log

### Infrastructure
- **PostgreSQL:** Local for testing, any managed URL for production (Railway, Supabase, Neon)
- **Redis:** Local for testing, any managed URL for production (Railway, Upstash)
- **Contract deploy:** Prepared in code, deploy when map UI is ready
- **KYC provider:** Sumsub (worldwide support)
  - Senders: national ID verification (any country Sumsub supports)
  - Riders: NIN (tier 1, compulsory) + driver's license verification (mandatory)

### Location Encryption
- Locations are **never stored in plaintext on-chain**
- API encrypts locations with AES-256-GCM before storing in PostgreSQL
- Contract stores only `bytes32` location hashes (commitments)
- API decrypts locations only for authorized users (sender, rider, recipient)
- Each location gets a unique random IV (initialization vector)

---

## Phase 1: PostgreSQL + Basic API

**Status:** Complete
**Goal:** Backend API with PostgreSQL for user profiles, rider data, job metadata.

### What was built

- `api/` directory - Express.js REST API
- PostgreSQL schema: users, riders, jobs, transactions
- CRUD endpoints for jobs, riders, users
- Contract event sync endpoint (on-chain to DB)
- Basic wallet signature verification (nonce-based)

### API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + DB connection |
| POST | `/auth/nonce` | Generate SIWE nonce for wallet |
| POST | `/auth/login` | Verify SIWE signature → JWT cookie |
| GET | `/auth/me` | Get current user from JWT |
| POST | `/auth/logout` | Clear JWT cookie |
| GET | `/jobs` | List jobs (query: status, rider, sender, limit, offset) |
| GET | `/jobs/:id` | Get job by on-chain ID |
| GET | `/jobs/:id/pin` | Get job PIN from chain |
| POST | `/jobs/sync` | Sync on-chain job data to DB |
| POST | `/jobs/sync-all` | Sync all jobs from chain |
| GET | `/riders` | List riders |
| GET | `/riders/:address` | Get rider profile |
| PUT | `/riders/:address` | Create or update rider profile |
| GET | `/users/:address` | Get user profile |
| PUT | `/users/:address` | Create or update user profile |
| POST | `/kyc/create-applicant` | Create Sumsub KYC applicant |
| GET | `/kyc/status/:address` | Check KYC verification status |
| POST | `/kyc/webhook` | Sumsub webhook handler |
| GET | `/kyc/token/:address` | Get Sumsub access token |

### Setup

```bash
cd api
npm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials
npm run db:create    # Create database + run schema
npm run db:seed      # Seed dev data
npm run dev          # Start API on port 3001
```

### Docker

```bash
docker compose up -d          # PostgreSQL + Redis + API
cd api && npm run db:create   # Init schema
```

---

## Phase 2: Encrypted Locations + Maps

**Status:** In progress
**Goal:** Pickup/delivery locations encrypted in DB, hashes on-chain. Map-first
marketplace with Leaflet/Google Maps abstraction.

### Encryption architecture

```
Sender enters: "123 Main St, San Francisco"
                │
                ▼
API encrypts:  AES-256-GCM(plaintext, LOCATION_KEY, randomIV)
                │
                ├─→ PostgreSQL: encrypted_pickup_location (ciphertext)
                │               location_salt (IV + auth tag)
                │
                └─→ Contract: keccak256(ciphertext) as bytes32
```

**Why this works:**
- Blockchain never sees plaintext addresses (privacy)
- Location hashes serve as commitments (can verify data hasn't changed)
- Only the API can decrypt (server-side key, not in git)
- Each location gets a unique IV (no pattern analysis possible)

### Contract changes

Add to Job struct:
```solidity
bytes32 pickupLocationHash;
bytes32 deliveryLocationHash;
```

Update `createJob` params:
```solidity
function createJob(
    address _recipient,
    address _rider,
    uint256 _durationMinutes,
    address _token,
    bytes32 _pickupLocationHash,
    bytes32 _deliveryLocationHash
) external payable returns (uint256)
```

**NOT deployed yet** - waiting for map UI to be ready.

### API encryption library

```
api/src/lib/encryption.js
  ├── encrypt(plaintext) → { ciphertext, iv, authTag }
  ├── decrypt(ciphertext, iv, authTag) → plaintext
  └── hashLocation(ciphertext) → bytes32
```

Uses Node.js built-in `crypto` module (AES-256-GCM). No external dependencies.

### DB schema additions

```sql
ALTER TABLE jobs ADD COLUMN encrypted_pickup_location TEXT;
ALTER TABLE jobs ADD COLUMN encrypted_delivery_location TEXT;
ALTER TABLE jobs ADD COLUMN location_salt VARCHAR(256);
```

### Maps abstraction

```
frontend/src/lib/mapConfig.js       # reads MAP_PROVIDER env
frontend/src/components/map/
  ├── MapView.jsx                    # shared pin display
  ├── LocationSearch.jsx             # shared autocomplete input
  ├── LeafletMap.jsx                 # leaflet + OpenStreetMap (free, default)
  └── GoogleMapsMap.jsx              # @vis.gl/react-google-maps
```

Env vars:
```
MAP_PROVIDER=leaflet                 # or "google"
GOOGLE_MAPS_API_KEY=                 # only if google
LOCATION_ENCRYPTION_KEY=             # 32-byte hex key for AES-256
```

### New dependencies

- `react-leaflet` + `leaflet` (free, frontend)
- `@vis.gl/react-google-maps` (Google, optional)

---

## Phase 3: Redis + Real-time

**Status:** In progress
**Goal:** Redis for caching, rate limiting, pub/sub. WebSocket for real-time job
updates. BullMQ for background tasks.

### Redis use cases

| Use case | Implementation | TTL |
|----------|---------------|-----|
| Cache open jobs | `GET/SET jobs:open` | 30s |
| Rate limiting | `express-rate-limit` + Redis store | per-endpoint |
| Nonce storage | `SET nonce:{address}` | 5min |
| Pub/Sub | `PUBLISH job:created`, `SUBSCRIBE` | none |
| Job queue | BullMQ `Queue` + `Worker` | configurable |

### WebSocket events

| Event | Direction | Payload |
|-------|-----------|---------|
| `job:created` | Server to riders | `{ jobId, pickup, amount, deadline }` |
| `job:accepted` | Server to all | `{ jobId, rider }` |
| `job:completed` | Server to all | `{ jobId }` |
| `job:cancelled` | Server to all | `{ jobId }` |
| `rider:subscribe` | Rider to server | `{ location, radius }` |

### BullMQ background tasks

- `sync-events` - Watch contract events, update DB
- `send-notifications` - Push notifications to riders
- `cleanup-expired` - Mark expired jobs as cancelled

### New dependencies

- `ioredis` (Redis client)
- `bullmq` (job queues)
- `ws` (WebSocket)
- `express-rate-limit` + `rate-limit-redis` (rate limiting)

### Env vars

```
REDIS_URL=redis://localhost:6379
```

---

## Phase 4: Auth + KYC (Sumsub)

**Status:** Complete
**Goal:** Full wallet-based auth with JWT. KYC via Sumsub for all participants.

### What was built

- **SIWE auth** (`POST /auth/nonce` → `POST /auth/login` → `GET /auth/me`)
  - Client signs SIWE message with wallet
  - Server verifies via `siwe` library + Redis nonce
  - Returns JWT in httpOnly cookie (7-day expiry)
  - JWT payload: `{ address, role }`
- **JWT middleware** — `authMiddleware` extracts user from cookie/Authorization header
  - `optionalAuth` for public routes that behave differently when authenticated
- **Sumsub KYC** (`/kyc/*` routes)
  - `POST /kyc/create-applicant` — creates Sumsub applicant with role-based level
  - `GET /kyc/status/:address` — checks live status from Sumsub + DB
  - `POST /kyc/webhook` — receives Sumsub review callbacks, updates DB
  - `GET /kyc/token/:address` — returns Sumsub access token for client-side flow
  - Senders: national ID verification
  - Riders: NIN + driver's license verification
- **Nonce storage** in Redis (5-minute TTL, replaces in-memory Map)
- **Schema update:** `kyc_applicant_id` column added to `users` table

### Auth flow

```
1. Client requests nonce from POST /auth/nonce
2. Client signs SIWE message with wallet → sends to POST /auth/login
3. Server verifies signature → returns JWT (httpOnly cookie)
4. All subsequent API calls authenticated via JWT
5. Role detected from DB (sender/rider/admin)
```

### KYC with Sumsub

**Senders:**
- National ID verification (any country Sumsub supports)
- Required before creating jobs above threshold

**Riders:**
- NIN verification (tier 1, compulsory - Nigeria)
- Driver's license verification (mandatory)
- Required before accepting jobs

### Sumsub integration

```
api/src/routes/kyc.js
  ├── POST /kyc/create-applicant    # Create Sumsub applicant
  ├── GET /kyc/status/:address      # Check KYC status
  ├── POST /kyc/webhook             # Sumsub webhook handler
  └── GET /kyc/token/:address       # Get Sumsub access token
```

### Dependencies

- `jsonwebtoken` — JWT sign/verify
- `siwe` — Sign-In with Ethereum (EIP-4361)
- `cookie-parser` — httpOnly cookie support
- Sumsub SDK (when ready)

---

## Phase 5: Production Hardening

**Status:** Planned
**Goal:** File storage, monitoring, CI/CD, production infrastructure.

### File storage
- Cloudflare R2 or AWS S3
- Rider profile photos
- KYC documents (Sumsub handles most, but backup storage)
- Delivery proof photos

### Monitoring
- Sentry for error tracking
- Structured logging (pino)
- Health check endpoints

### CI/CD
- GitHub Actions: lint → test → build → deploy
- Separate workflows for testnet and mainnet

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│        Astro + React + RainbowKit + Maps            │
│        (Leaflet / Google Maps via MAP_PROVIDER)     │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
           ▼                  ▼
┌────────────────────┐  ┌──────────────────────┐
│    Backend API     │  │    Contract          │
│    Express.js      │  │    DeliveryEscrow    │
│    PostgreSQL      │  │    Monad Chain       │
│    Redis (cache)   │  │                      │
│    WebSocket       │  │    Location hashes   │
│    BullMQ          │  │    only (encrypted   │
│    AES-256-GCM     │  │    data in DB)       │
└────────┬───────────┘  └──────────┬───────────┘
         │                         │
         ▼                         ▼
┌────────────────────┐  ┌──────────────────────┐
│    PostgreSQL      │  │    Envio             │
│    (encrypted      │  │    HyperIndex        │
│     locations,     │  │    (event sync)      │
│     users, jobs)   │  │                      │
└────────────────────┘  └──────────────────────┘
         │
         ▼
┌────────────────────┐
│    Redis           │
│    (cache, pub/sub,│
│     rate limiting) │
└────────────────────┘
```

---

## Technology Choices

| Layer | Choice | Why |
|-------|--------|-----|
| Database | PostgreSQL | Battle-tested, flexible |
| Cache/Queue | Redis + BullMQ | Real-time pub/sub, rate limiting, job queues |
| API | Express.js | Simple, well-known |
| Encryption | AES-256-GCM (Node crypto) | No external deps, hardware-accelerated |
| Maps | Leaflet (default) + Google Maps (optional) | Free default, paid option for better UX |
| Auth | SIWE + JWT | Wallet-native, no passwords |
| WebSocket | ws | Lightweight, fast |
| Indexer | Envio HyperIndex | Watch contract events, populate DB |
| KYC | Sumsub | Worldwide support, NIN + license for riders |
| Storage | Cloudflare R2 | Cheaper than S3, S3-compatible |

---

## Deployment

### Local development

```bash
# Start infrastructure
docker compose up -d

# Init database
cd api && npm run db:create && npm run db:seed

# Start API
cd api && npm run dev

# Start frontend
cd frontend && npm run dev
```

### Production

```bash
# API
docker build -t dispatra-api ./api
docker run -p 3001:3001 --env-file .env dispatra-api

# Database
# Use managed PostgreSQL (provide DATABASE_URL in .env)
# Use managed Redis (provide REDIS_URL in .env)
```
