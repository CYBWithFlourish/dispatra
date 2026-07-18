const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { ethers } = require("ethers");
require("dotenv").config();

const KEYPAIR_PATH = path.join(__dirname, "..", ".keypair");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

function loadKeypair() {
  if (fs.existsSync(KEYPAIR_PATH)) {
    return JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  }

  const mnemonic = process.env.KEYPAIR_MNEMONIC;
  const privateKey = process.env.KEYPAIR_PRIVATE_KEY;
  const address = process.env.KEYPAIR_ADDRESS;

  if (privateKey && address) {
    return { mnemonic: mnemonic || "", privateKey, address };
  }

  console.error("No .keypair file or KEYPAIR_* env vars found. Run: npm run keypair:generate");
  process.exit(1);
}

function saveKeypair(data) {
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log("Saved to .keypair");
}

function getNetworkKey() {
  return (process.env.MONAD_NETWORK || "TESTNET").toUpperCase();
}

function getRpcUrl() {
  const network = getNetworkKey();
  const envKey = `MONAD_${network}_RPC_URL`;
  const fallback = network === "MAINNET" ? "https://rpc.monad.xyz" : "https://testnet-rpc.monad.xyz";
  return process.env[envKey] || fallback;
}

function getUsdcAddress() {
  const network = getNetworkKey();
  const envKey = `MONAD_${network}_USDC_ADDRESS`;
  return process.env[envKey] || null;
}

function getProvider() {
  return new ethers.JsonRpcProvider(getRpcUrl());
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const override = args.includes("--override");
  const network = getNetworkKey();

  if (command === "generate") {
    if (fs.existsSync(KEYPAIR_PATH) && !override) {
      const answer = await question(".keypair already exists. Override? (y/N): ");
      if (answer !== "y" && answer !== "yes") {
        console.log("Aborted.");
        process.exit(0);
      }
    }

    const wallet = ethers.Wallet.createRandom();
    const data = {
      mnemonic: wallet.mnemonic.phrase,
      privateKey: wallet.privateKey,
      address: wallet.address,
      path: wallet.mnemonic.path,
    };
    saveKeypair(data);
    console.log("Address:", wallet.address);
    console.log("Private Key:", wallet.privateKey);
    console.log("Mnemonic:", wallet.mnemonic.phrase);
  } else if (command === "mnemonic") {
    const kp = loadKeypair();
    console.log("Mnemonic:", kp.mnemonic);
  } else if (command === "address") {
    const kp = loadKeypair();
    console.log("Address:", kp.address);
  } else if (command === "privatekey" || command === "key") {
    const kp = loadKeypair();
    console.log("Private Key:", kp.privateKey);
  } else if (command === "balance") {
    const kp = loadKeypair();
    const provider = getProvider();

    console.log("--- Balance ---");
    console.log("Address :", kp.address);
    console.log("Network :", network);
    console.log("RPC     :", getRpcUrl());
    console.log();

    const bal = await provider.getBalance(kp.address);
    console.log("MON     :", ethers.formatEther(bal), "MON");

    const usdcAddr = getUsdcAddress();
    if (usdcAddr) {
      const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, provider);
      const [decimals, symbol] = await Promise.all([usdc.decimals(), usdc.symbol()]);
      const usdcBal = await usdc.balanceOf(kp.address);
      console.log("USDC    :", ethers.formatUnits(usdcBal, decimals), symbol);
    } else {
      console.log("USDC    : (no USDC address configured for", network, ")");
    }
  } else if (command === "send") {
    const kp = loadKeypair();
    const to = args[1];
    const amount = args[2];
    const tokenFlag = args.indexOf("--token");
    const tokenAddress = tokenFlag !== -1 ? args[tokenFlag + 1] : null;

    if (!to || !amount) {
      console.error("Usage: npm run keypair:send <to_address> <amount> [--token <address>]");
      process.exit(1);
    }

    const provider = getProvider();
    const wallet = new ethers.Wallet(kp.privateKey, provider);

    let tx;
    if (tokenAddress) {
      const usdc = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = await usdc.decimals();
      const parsedAmount = ethers.parseUnits(amount, decimals);
      console.log("Sending", amount, "tokens to", to, "...");
      tx = await usdc.transfer(to, parsedAmount);
    } else {
      console.log("Sending", amount, "MON to", to, "...");
      tx = await wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });
    }

    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("Confirmed");
  } else {
    console.log("Usage: npm run keypair:<command> [args]");
    console.log();
    console.log("Commands:");
    console.log("  generate [--override]        Generate a new keypair");
    console.log("  mnemonic                     Show mnemonic phrase");
    console.log("  address                      Show wallet address");
    console.log("  privatekey                   Show private key");
    console.log("  balance                      Show MON + USDC balance");
    console.log("  send <to> <amount> [--token <addr>]  Send MON or ERC-20");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
