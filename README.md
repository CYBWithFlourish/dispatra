# Dispatra

On-chain delivery escrow on Monad. Sender locks payment for a delivery; rider only
gets paid when the recipient's confirmation code is submitted on-chain. No middleman
holding funds, no dispute over "did it actually get delivered."

**License:** [GPL-3.0](LICENSE)

## Prerequisites

- Node.js 18+ and npm
- A Monad testnet/mainnet wallet with MON
- MetaMask (or any EVM wallet) configured for Monad

## Tech Stack

- **Contracts:** Solidity + Hardhat
- **Frontend:** Astro (static-first, islands for wallet-connected components)
- **Chain client:** ethers.js v6
- **Wallet connect:** RainbowKit + MetaMask (window.ethereum) - RainbowKit for UI,
  MetaMask as the primary wallet provider

## Monorepo Structure

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
├── AGENTS.md
└── README.md
```

## Setup

### 1. Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env: set MONAD_NETWORK=TESTNET, add KEYPAIR_PRIVATE_KEY
npm run keypair:generate   # optional: generate a new wallet
npx hardhat compile
npx hardhat test
```

Deploy to testnet:
```bash
npm run deploy:testnet
```

Deploy to mainnet:
```bash
npm run deploy:mainnet
```

Deploy script outputs a JSON file to `deployed.TESTNET/` or `deployed.MAINNET/` with
the contract address, tx hash, gas used, and explorer links.

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

Open http://localhost:4321 in your browser with MetaMask configured for Monad.

## Admin Script

After deployment, use the admin script to manage the contract:

```bash
cd contracts

# Show current contract state (owner, fees, fee recipient)
npm run admin -- info

# Set fees (in basis points, 120 = 1.2%)
npm run admin -- set-fee job 200      # 2% on job creation
npm run admin -- set-fee rider 100    # 1% on rider registration

# Set fee recipient
npm run admin -- set-fee-recipient 0x...

# Add/remove supported ERC-20 tokens
npm run admin -- add-token 0x534b2f3A21130d7a60830c2Df862319e593943A3
npm run admin -- remove-token 0x...

# Transfer ownership
npm run admin -- transfer-ownership 0x...
```

## Wallet Keypair Script

If you don't have an EVM wallet or need a fresh test account, use the built-in keypair
generator. It creates a mnemonic, private key, and address, then saves them to
`contracts/.keypair` (gitignored).

```bash
cd contracts

# Generate a new wallet (prompts before overwriting existing .keypair)
npm run keypair:generate

# Force overwrite without prompt
npm run keypair:generate:force

# Show the saved mnemonic / address / private key
npm run keypair:mnemonic
npm run keypair:address
npm run keypair:privatekey

# Check MON + USDC balance (network-aware via MONAD_NETWORK)
npm run keypair:balance

# Send MON to another address
npm run keypair:send <to_address> <amount>

# Send ERC-20 token (e.g. USDC)
npm run keypair:send <to_address> <amount> --token <token_address>
```

> **Warning:** The `.keypair` file contains real private key material. Never commit it
> to version control. It is already listed in `.gitignore`.

## How It Works

1. **Sender** creates a job: locks MON (or ERC-20) in escrow, sets a recipient, rider, confirmation code hash, and timeout. A 1.2% fee is deducted on creation.
2. **Rider** accepts the job.
3. **Recipient** (or anyone with the code) submits the confirmation code on-chain.
4. If the code matches the hash, the escrowed funds are released to the rider (no fee on payout).
5. If the job is not confirmed before the deadline, the sender can cancel and get a refund (fee is not refunded).
6. Riders pay a 1.2% registration fee to join the platform.

## Contract Functions

### Core
- `createJob(address _recipient, address _rider, bytes32 _confirmationCodeHash, uint256 _durationMinutes, address _token)` - Create and fund a delivery job
- `acceptJob(uint256 _jobId)` - Rider accepts the job
- `confirmDelivery(uint256 _jobId, string calldata _confirmationCode)` - Submit confirmation code to release funds
- `cancelAndRefund(uint256 _jobId)` - Sender cancels and gets refund (before acceptance or after timeout)

### Registration
- `registerRider()` - Register as a rider (payable, fee charged)

### Admin (owner-only)
- `setJobCreationFee(uint256 _bps)` - Set job creation fee in basis points
- `setRiderRegistrationFee(uint256 _bps)` - Set rider registration fee in basis points
- `setFeeRecipient(address _recipient)` - Set fee recipient address
- `addToken(address _token)` - Whitelist an ERC-20 token
- `removeToken(address _token)` - Remove a token from support
- `transferOwnership(address _newOwner)` - Transfer contract ownership

## Supported Tokens

| Token | Testnet Address | Mainnet Address |
|-------|----------------|-----------------|
| Native MON | `address(0)` | `address(0)` |
| USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |

More tokens can be added by the contract owner via `addToken()` without redeploying.

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Monad Testnet | 10143 | https://testnet-rpc.monad.xyz |
| Monad Mainnet | 143 | https://rpc.monad.xyz |

## Security Notes

- Confirmation codes are stored as `keccak256` hashes on-chain, not plaintext.
- Only the sender can cancel and refund.
- Funds are held directly in the contract until delivery is confirmed or the job is cancelled.
- Fees are collected on job creation and rider registration, not on delivery confirmation.
- Contract has reentrancy protection on `confirmDelivery`, `cancelAndRefund`, and `registerRider`.

## License

GPL-v3.0
