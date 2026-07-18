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
- **Wallet connect:** RainbowKit + MetaMask (window.ethereum) - RainbowKit for UI,
  MetaMask as the primary wallet provider

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
│   │   ├── deploy.js             # Deploy + saves to deployed.{NETWORK}/
│   │   ├── admin.js              # Contract lifecycle (fees, tokens, ownership)
│   │   ├── explorer.js           # Explorer links (Monadscan + BlockVision)
│   │   └── keypair.cjs           # Wallet generator (generate, balance, send)
│   ├── deployed.TESTNET/         # Deployed contract data (gitignored)
│   ├── deployed.MAINNET/         # Deployed contract data (gitignored)
│   ├── hardhat.config.js
│   ├── .env                      # MONAD_NETWORK, KEYPAIR_*, MONAD_*_RPC_URL (gitignored)
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── frontend/                     # Astro + React + RainbowKit project
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro       # role picker: Sender / Rider
│   │   │   ├── sender.astro      # sender page wrapper
│   │   │   └── rider.astro       # rider page wrapper
│   │   ├── components/
│   │   │   ├── Providers.jsx         # wagmi + RainbowKit provider wrapper
│   │   │   ├── WalletConnect.jsx     # RainbowKit ConnectButton island
│   │   │   ├── JobCreateForm.jsx     # island: sender creates a job
│   │   │   ├── JobList.jsx           # island: rider sees open jobs
│   │   │   ├── ConfirmDelivery.jsx   # island: rider enters code
│   │   │   ├── SenderPage.jsx        # sender page with providers
│   │   │   └── RiderPage.jsx         # rider page with providers
│   │   ├── lib/
│   │   │   ├── contract.js       # ethers.js contract instance + ABI import
│   │   │   ├── abi.json          # copied from contracts/artifacts after compile
│   │   │   └── constants.js      # deployed contract address, chain config
│   │   └── layouts/
│   │       └── Base.astro
│   ├── astro.config.mjs
│   ├── package.json
│   ├── .env                      # PUBLIC_CONTRACT_ADDRESS, PUBLIC_RPC_URL, PUBLIC_CHAIN_ID
│   ├── .env.example
│   ├── .gitignore
│   └── tsconfig.json
│
├── .agents/                      # Agent skills
├── .gitignore
├── AGENTS.md                     # this file
├── LICENSE                       # GPL-3.0
└── README.md
```

---

## Setup commands

### 1. Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env: set MONAD_NETWORK=TESTNET, add KEYPAIR_PRIVATE_KEY
npm run keypair:generate
npx hardhat compile
npx hardhat test
```

`hardhat.config.js` has `monadTestnet` and `monadMainnet` network entries pointing at the
current RPC URL and chain ID (verify against docs, don't assume) plus
`accounts: [process.env.KEYPAIR_PRIVATE_KEY]`.

Deploy:
```bash
npm run deploy:testnet
```

Deploy to mainnet:
```bash
npm run deploy:mainnet
```

Deploy script outputs a JSON file to `deployed.TESTNET/` or `deployed.MAINNET/` with
the contract address, tx hash, gas used, and explorer links (Monadscan + BlockVision).

After deploy, copy the ABI from `contracts/artifacts/contracts/DeliveryEscrow.sol/DeliveryEscrow.json`
into `frontend/src/lib/abi.json`, and paste the deployed address into
`frontend/src/lib/constants.js` and `frontend/.env`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with the deployed contract address and RPC URL
npm run dev
```

Frontend uses Astro + React + RainbowKit + wagmi. Wallet-connected components
(`WalletConnect`, `JobCreateForm`, `JobList`, `ConfirmDelivery`) need `client:load`
directives since they depend on RainbowKit / `window.ethereum`, which doesn't exist
at build/SSR time.

---

## Build order

1. `DeliveryEscrow.sol` - `createJob`, `acceptJob`, `confirmDelivery`, `cancelAndRefund`
2. Fees + token support - `registerRider`, admin functions, ERC-20 (USDC) integration
3. Tests - happy path + refund-on-timeout + fees + registration + admin
4. Deploy to Monad testnet, verify address works via a quick script call
5. `WalletConnect` island (RainbowKit + MetaMask, get wallet address + balance showing)
6. `sender.astro` flow - create job, show generated code, show job status
7. `rider.astro` flow - list open jobs, accept, enter code, confirm
8. Demo polish - two browser profiles/wallets side by side to show sender + rider live

## Conventions for agents editing this repo

- Contract functions: `createJob`, `acceptJob`, `confirmDelivery`, `cancelAndRefund`,
  `registerRider` - keep these exact names, frontend calls reference them directly.
- Admin functions: `setJobCreationFee`, `setRiderRegistrationFee`, `setFeeRecipient`,
  `addToken`, `removeToken`, `transferOwnership` - owner-only contract lifecycle.
- Confirmation code: stored on-chain as `keccak256` hash, not plaintext, to keep it
  simple but not trivially readable from a block explorer.
- Fees: 120 bps (1.2%) default on job creation and rider registration. No fee on
  delivery confirmation. Fees go to `feeRecipient`, not the contract.
- Tokens: native MON via `address(0)`, ERC-20 via `transferFrom`/`transfer`. Supported
  tokens managed by `supportedTokens` mapping, owner can add/remove without redeploy.
- Network config: `MONAD_NETWORK=TESTNET|MAINNET` in `.env` drives RPC URL selection
  and deploy output directory (`deployed.TESTNET/` or `deployed.MAINNET/`).
- No backend server - frontend talks to the contract directly via ethers.js. If a
  future iteration needs off-chain indexing (job history, etc.), that's a v2 concern,
  not part of this build.
- Keep `.env` files out of git. `.env.example` should list required keys with no values.
