# AGENTS.md - Dispatra

On-chain delivery escrow on Monad. Sender locks payment for a delivery; rider only
gets paid when the recipient's confirmation code is submitted on-chain. No middleman
holding funds, no dispute over "did it actually get delivered."

This file is context for any AI coding agent (Claude Code, etc.) working in this repo.
Built for a 6-hour hackathon build - favor working over exhaustive.

---

## Prerequisites

- Node.js 18+ and npm
- A Monad testnet wallet with test MON (get from Monad testnet faucet)
- MetaMask (or any EVM wallet) configured for Monad testnet:
  - RPC URL: confirm current testnet RPC at https://docs.monad.xyz (changes - check before building)
  - Chain ID: confirm current testnet chain ID at the same docs link
- Git

Do not hardcode RPC URL or chain ID from memory - always verify against current Monad
testnet docs before deploy, these values have changed across testnet phases.

---

## Tech stack

- **Contracts:** Solidity + Hardhat
- **Frontend:** Astro (static-first, islands for wallet-connected components)
- **Chain client:** ethers.js v6
- **Wallet connect:** MetaMask browser injection (`window.ethereum`) - no WalletConnect,
  no RainbowKit, skip for time

---

## Monorepo structure

```
dispatra/
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   └── DeliveryEscrow.sol
│   ├── test/
│   │   └── DeliveryEscrow.test.js
│   ├── scripts/
│   │   └── deploy.js
│   ├── hardhat.config.js
│   ├── .env                      # PRIVATE_KEY, MONAD_TESTNET_RPC_URL (gitignored)
│   ├── .env.example
│   └── package.json
│
├── frontend/                     # Astro project
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro       # role picker: Sender / Rider
│   │   │   ├── sender.astro      # create job, lock funds, view status, cancel/refund
│   │   │   └── rider.astro       # browse open jobs, accept, enter code, confirm
│   │   ├── components/
│   │   │   ├── WalletConnect.astro   # island: connect MetaMask, show address/balance
│   │   │   ├── JobCreateForm.astro   # island: sender creates a job
│   │   │   ├── JobList.astro         # island: rider sees open jobs
│   │   │   └── ConfirmDelivery.astro # island: rider enters code
│   │   ├── lib/
│   │   │   ├── contract.js       # ethers.js contract instance + ABI import
│   │   │   ├── abi.json          # copied from contracts/artifacts after compile
│   │   │   └── constants.js      # deployed contract address, chain config
│   │   └── layouts/
│   │       └── Base.astro
│   ├── astro.config.mjs
│   ├── package.json
│   └── .env                      # PUBLIC_CONTRACT_ADDRESS, PUBLIC_RPC_URL
│
├── AGENTS.md                     # this file
└── README.md
```

---

## Setup commands

### 1. Contracts

```bash
mkdir contracts && cd contracts
npx hardhat init          # choose "Create a JavaScript project"
npm install --save-dev @nomicfoundation/hardhat-toolbox dotenv
```

`hardhat.config.js` needs a `monadTestnet` network entry pointing at the current RPC
URL and chain ID (verify against docs, don't assume) plus `accounts: [process.env.PRIVATE_KEY]`.

Deploy:
```bash
npx hardhat run scripts/deploy.js --network monadTestnet
```

After deploy, copy the ABI from `contracts/artifacts/contracts/DeliveryEscrow.sol/DeliveryEscrow.json`
into `frontend/src/lib/abi.json`, and paste the deployed address into
`frontend/src/lib/constants.js` and `frontend/.env`.

### 2. Frontend

```bash
npm create astro@latest frontend -- --template minimal --no-install
cd frontend
npm install
npm install ethers
npx astro add react   # only if an island needs React state; otherwise skip, use vanilla JS in <script>
npm run dev
```

Astro pages stay static by default - wallet-connected components (`WalletConnect`,
`JobCreateForm`, `JobList`, `ConfirmDelivery`) need `client:load` directives since they
depend on `window.ethereum`, which doesn't exist at build/SSR time.

---

## Build order (matches the 6-hour plan)

1. `DeliveryEscrow.sol` - `createJob`, `acceptJob`, `confirmDelivery`, `cancelAndRefund`
2. Tests - happy path + refund-on-timeout
3. Deploy to Monad testnet, verify address works via a quick script call
4. Astro scaffold + `WalletConnect` island (get wallet address + balance showing)
5. `sender.astro` flow - create job, show generated code, show job status
6. `rider.astro` flow - list open jobs, accept, enter code, confirm
7. Demo polish - two browser profiles/wallets side by side to show sender + rider live

## Conventions for agents editing this repo

- Contract functions: `createJob`, `acceptJob`, `confirmDelivery`, `cancelAndRefund` -
  keep these exact names, frontend calls reference them directly.
- Confirmation code: stored on-chain as `keccak256` hash, not plaintext, to keep it
  simple but not trivially readable from a block explorer.
- No backend server - frontend talks to the contract directly via ethers.js. If a
  future iteration needs off-chain indexing (job history, etc.), that's a v2 concern,
  not part of this build.
- Keep `.env` files out of git. `.env.example` should list required keys with no values.
