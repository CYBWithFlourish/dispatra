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
│   │   ├── deploy.js
│   │   └── keypair.js        # EVM wallet generator (generate, mnemonic, balance, send)
│   ├── hardhat.config.js
│   ├── .env                      # PRIVATE_KEY, MONAD_*_RPC_URL (gitignored)
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
├── frontend/                     # Astro project
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
│   ├── .env                      # PUBLIC_CONTRACT_ADDRESS, PUBLIC_RPC_URL
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
# Edit .env with your PRIVATE_KEY and MONAD_*_RPC_URL
npx hardhat compile
npx hardhat test
```

Deploy to testnet:
```bash
npx hardhat run scripts/deploy.js --network monadTestnet
```

Deploy to mainnet:
```bash
npx hardhat run scripts/deploy.js --network monadMainnet
```

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

## Wallet Keypair Script

If you don't have an EVM wallet or need a fresh test account, use the built-in keypair
generator. It creates a mnemonic, private key, and address, then saves them to
`contracts/.keypair` (gitignored).

```bash
cd contracts

# Generate a new wallet (prompts before overwriting existing .keypair)
npm run keypair:generate

# Force overwrite without prompt
npm run keypair:generate -- --override
# or
npm run keypair:generate:force

# Show the saved mnemonic
npm run keypair:mnemonic

# Show the saved address
npm run keypair:address

# Check balance on Monad testnet
npm run keypair:balance

# Send MON to another address
npm run keypair:send <to_address> <amount_in_mon>
```

> **Warning:** The `.keypair` file contains real private key material. Never commit it
> to version control. It is already listed in `.gitignore`.

## How It Works

1. **Sender** creates a job: locks MON in escrow, sets a recipient address, rider address, and a confirmation code hash, plus a timeout duration.
2. **Rider** accepts the job.
3. **Recipient** (or anyone with the code) submits the confirmation code on-chain.
4. If the code matches the hash, the escrowed MON is released to the rider.
5. If the job is not confirmed before the deadline, the sender can cancel and get a refund.

## Contract Functions

- `createJob(address _recipient, address _rider, bytes32 _confirmationCodeHash, uint256 _durationMinutes)` - Create and fund a delivery job
- `acceptJob(uint256 _jobId)` - Rider accepts the job
- `confirmDelivery(uint256 _jobId, string calldata _confirmationCode)` - Submit confirmation code to release funds
- `cancelAndRefund(uint256 _jobId)` - Sender cancels job and gets refund (before acceptance or after timeout)

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Monad Testnet | 10143 | https://testnet-rpc.monad.xyz |
| Monad Mainnet | 143 | https://rpc.monad.xyz |

## Security Notes

- Confirmation codes are stored as `keccak256` hashes on-chain, not plaintext.
- Only the sender can cancel and refund.
- Funds are held directly in the contract until the delivery is confirmed or the job is cancelled.

## License

GPL-v3.0