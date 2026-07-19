# SETUP.md - Dispatra Local Development Setup

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Docker & Docker Compose | 20+ | `docker --version` |
| MetaMask | Latest | Browser extension |
| Git | 2+ | `git --version` |

### Monad Testnet MON

You need testnet MON to pay for gas. Get it from the Monad testnet faucet:
- https://faucet.monad.xyz

Connect your wallet, paste your address, and request MON. You may need to do this
multiple times for a second wallet (rider).

### MetaMask - Monad Testnet Configuration

If Monad testnet isn't in your MetaMask:

1. Open MetaMask → Settings → Networks → Add Network
2. Enter:
   - **Network Name:** Monad Testnet
   - **RPC URL:** `https://testnet-rpc.monad.xyz`
   - **Chain ID:** `10143`
   - **Currency Symbol:** MON
   - **Block Explorer:** `https://testnet.monadexplorer.com`
3. Save

### Two Wallets for Demo

For a full demo you need two separate MetaMask wallets:

1. **Sender wallet** - creates jobs, funds escrow
2. **Rider wallet** - accepts jobs, confirms delivery

You can either:
- Create two MetaMask profiles (Settings → Add account), or
- Import a second account via private key (Account dropdown → Import Account)

Both wallets need MON on testnet.

---

## Project Structure

```
dispatra/
├── contracts/    # Hardhat (Solidity contracts)
├── api/          # Express.js API (PostgreSQL, Redis, SIWE auth, KYC)
├── frontend/     # Astro + React + RainbowKit
└── docker-compose.yml  # PostgreSQL + Redis
```

---

## Step 1: Start Infrastructure (PostgreSQL + Redis)

```bash
cd dispatra
docker compose up -d
```

Verify both are running:

```bash
docker compose ps
```

You should see `dispatra-postgres` and `dispatra-redis` both healthy.

---

## Step 2: API Setup

```bash
cd api
npm install
cp .env.example .env
```

Edit `api/.env` with your values:

```env
DATABASE_URL=postgresql://dispatra:dispatra@localhost:5432/dispatra
API_PORT=3001
API_HOST=0.0.0.0
JWT_SECRET=your-random-secret-here
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
CONTRACT_ADDRESS=0x2C4E4EB9432F9736627615f6d8096D826b17c532
LOCATION_ENCRYPTION_KEY=  # 32-byte hex key (see below)
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:4321
NODE_ENV=development

# Sumsub KYC (optional - see SUMSUB_SETUP.md)
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=
SUMSUB_BASE_URL=https://api.sumsub.com
```

Generate a `LOCATION_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start the API (database initializes automatically):

```bash
npm run dev
```

The API automatically creates all database tables on first startup. To disable
auto-init, set `AUTO_INIT_DB=false` in your `.env`. For manual schema management:

```bash
npm run db:create    # run schema manually
npm run db:seed      # optional: loads dev data
```

API runs on http://localhost:3001. Verify with:

```bash
curl http://localhost:3001/health
```

---

## Step 3: Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```env
PUBLIC_MONAD_NETWORK=TESTNET
PUBLIC_CONTRACT_ADDRESS_TESTNET=0x2C4E4EB9432F9736627615f6d8096D826b17c532
PUBLIC_CONTRACT_ADDRESS_MAINNET=
PUBLIC_RPC_URL_TESTNET=https://testnet-rpc.monad.xyz
PUBLIC_RPC_URL_MAINNET=https://rpc.monad.xyz
PUBLIC_CHAIN_ID_TESTNET=10143
PUBLIC_CHAIN_ID_MAINNET=143
WALLETCONNECT_PROJECT_ID=    # optional: get from cloud.walletconnect.com
PUBLIC_MAP_PROVIDER=leaflet
PUBLIC_GOOGLE_MAPS_API_KEY=
```

Start the frontend:

```bash
npm run dev
```

Frontend runs on http://localhost:4321.

---

## Step 4: Verify Everything Works

In three separate terminals:

```
Terminal 1:  docker compose up -d
Terminal 2:  cd api && npm run dev
Terminal 3:  cd frontend && npm run dev
```

Checklist:
- [ ] http://localhost:3001/health returns OK
- [ ] http://localhost:4321 loads the homepage
- [ ] MetaMask connects on the frontend
- [ ] Both wallets have testnet MON

---

## Verification

Dispatra supports two verification methods:

### Wallet Verification (Default)
No external API needed. Users sign a message with their wallet to prove ownership.
Instant verification, no documents required.

### Full KYC (Optional)
For production use, Sumsub integration provides document-based verification.
See [SUMSUB_SETUP.md](SUMSUB_SETUP.md) for configuration.

---

## Environment Variable Reference

### api/.env

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_PORT` | Yes | API port (default: 3001) |
| `API_HOST` | Yes | Bind address (default: 0.0.0.0) |
| `JWT_SECRET` | Yes | Random string for JWT signing |
| `MONAD_RPC_URL` | Yes | Monad testnet RPC |
| `CONTRACT_ADDRESS` | Yes | Deployed DeliveryEscrow address |
| `LOCATION_ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM |
| `REDIS_URL` | Yes | Redis connection string |
| `CORS_ORIGIN` | Yes | Frontend URL for CORS |
| `NODE_ENV` | Yes | `development` or `production` |
| `SUMSUB_APP_TOKEN` | No | Sumsub app token (optional, see SUMSUB_SETUP.md) |
| `SUMSUB_SECRET_KEY` | No | Sumsub secret key (optional) |
| `SUMSUB_BASE_URL` | No | Sumsub API base URL (optional) |

### frontend/.env

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_MONAD_NETWORK` | Yes | `TESTNET` or `MAINNET` |
| `PUBLIC_CONTRACT_ADDRESS_TESTNET` | Yes | Deployed contract address |
| `PUBLIC_RPC_URL_TESTNET` | Yes | Monad testnet RPC |
| `PUBLIC_CHAIN_ID_TESTNET` | Yes | Monad testnet chain ID |
| `WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID |
| `PUBLIC_MAP_PROVIDER` | Yes | `leaflet` or `google` |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | No | Google Maps key (if using Google) |

### contracts/.env

| Variable | Required | Description |
|----------|----------|-------------|
| `MONAD_NETWORK` | Yes | `TESTNET` or `MAINNET` |
| `KEYPAIR_PRIVATE_KEY` | Yes | Deployer wallet private key |
| `KEYPAIR_MNEMONIC` | Generated | Keypair mnemonic |
| `KEYPAIR_ADDRESS` | Generated | Keypair address |
| `MONAD_TESTNET_RPC_URL` | Yes | Monad testnet RPC |

---

## Quick Reset

To start fresh:

```bash
docker compose down -v          # stop + remove volumes
docker compose up -d
cd api && npm run db:create && npm run db:seed && npm run dev
# In another terminal:
cd frontend && npm run dev
```
