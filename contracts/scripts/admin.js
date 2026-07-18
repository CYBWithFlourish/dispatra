const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { getExplorers, buildLinks, pickExplorer, printLinks } = require("./explorer");

const CONTRACT_NAME = "DeliveryEscrow";

function getNetworkKey() {
  const net = process.env.MONAD_NETWORK || "TESTNET";
  return net.toUpperCase();
}

function loadDeployData(networkKey) {
  const deployPath = path.join(__dirname, "..", `deployed.${networkKey}`, `${CONTRACT_NAME}.json`);
  if (!fs.existsSync(deployPath)) {
    console.error(`No deployment found at ${deployPath}`);
    console.error("Run deploy first for this network.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(deployPath, "utf8"));
}

function parseBps(bps) {
  const val = parseInt(bps, 10);
  if (isNaN(val) || val < 0 || val > 10000) {
    console.error("Invalid basis points value (0-10000)");
    process.exit(1);
  }
  return val;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const networkKey = getNetworkKey();
  const deployData = loadDeployData(networkKey);

  const explorerBase = networkKey === "TESTNET" ? "testnet." : "";
  const hreNetwork = networkKey === "TESTNET" ? "monadTestnet" : "monadMainnet";

  console.log("--- Admin ---");
  console.log("Network :", networkKey);
  console.log("Contract:", deployData.contractAddress);
  console.log();

  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployData.contractAddress, signer);

  if (command === "info") {
    const owner = await contract.owner();
    const feeRecipient = await contract.feeRecipient();
    const jobFee = await contract.jobCreationFeeBps();
    const riderFee = await contract.riderRegistrationFeeBps();

    console.log("--- Contract State ---");
    console.log("Owner              :", owner);
    console.log("Fee Recipient      :", feeRecipient);
    console.log("Job Creation Fee   :", jobFee.toString(), "bps (" + (Number(jobFee) / 100).toFixed(2) + "%)");
    console.log("Registration Fee   :", riderFee.toString(), "bps (" + (Number(riderFee) / 100).toFixed(2) + "%)");
    console.log("Signer             :", signer.address);
    console.log("Is Owner           :", signer.address.toLowerCase() === owner.toLowerCase());

    const allLinks = deployData.explorerLinks || buildLinks(
      getExplorers(hreNetwork),
      deployData.contractAddress,
      deployData.deployTxHash
    );
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else if (command === "set-fee") {
    const type = args[1];
    const bps = parseBps(args[2]);
    if (!type || !args[2]) {
      console.error("Usage: npm run admin -- set-fee <job|rider> <bps>");
      process.exit(1);
    }
    let tx;
    if (type === "job") {
      console.log("Setting job creation fee to", bps, "bps (" + (bps / 100).toFixed(2) + "%)...");
      tx = await contract.setJobCreationFee(bps);
    } else if (type === "rider") {
      console.log("Setting rider registration fee to", bps, "bps (" + (bps / 100).toFixed(2) + "%)...");
      tx = await contract.setRiderRegistrationFee(bps);
    } else {
      console.error("Fee type must be 'job' or 'rider'");
      process.exit(1);
    }
    const receipt = await tx.wait();
    console.log("Done. TX:", receipt.hash);
    const allLinks = buildLinks(getExplorers(hreNetwork), deployData.contractAddress, receipt.hash);
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else if (command === "set-fee-recipient") {
    const addr = args[1];
    if (!addr) {
      console.error("Usage: npm run admin -- set-fee-recipient <address>");
      process.exit(1);
    }
    console.log("Setting fee recipient to", addr, "...");
    const tx = await contract.setFeeRecipient(addr);
    const receipt = await tx.wait();
    console.log("Done. TX:", receipt.hash);
    const allLinks = buildLinks(getExplorers(hreNetwork), deployData.contractAddress, receipt.hash);
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else if (command === "add-token") {
    const token = args[1];
    if (!token) {
      console.error("Usage: npm run admin -- add-token <token_address>");
      process.exit(1);
    }
    console.log("Adding token", token, "...");
    const tx = await contract.addToken(token);
    const receipt = await tx.wait();
    console.log("Done. TX:", receipt.hash);
    const allLinks = buildLinks(getExplorers(hreNetwork), deployData.contractAddress, receipt.hash);
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else if (command === "remove-token") {
    const token = args[1];
    if (!token) {
      console.error("Usage: npm run admin -- remove-token <token_address>");
      process.exit(1);
    }
    console.log("Removing token", token, "...");
    const tx = await contract.removeToken(token);
    const receipt = await tx.wait();
    console.log("Done. TX:", receipt.hash);
    const allLinks = buildLinks(getExplorers(hreNetwork), deployData.contractAddress, receipt.hash);
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else if (command === "transfer-ownership") {
    const newOwner = args[1];
    if (!newOwner) {
      console.error("Usage: npm run admin -- transfer-ownership <address>");
      process.exit(1);
    }
    console.log("Transferring ownership to", newOwner, "...");
    const tx = await contract.transferOwnership(newOwner);
    const receipt = await tx.wait();
    console.log("Done. TX:", receipt.hash);
    const allLinks = buildLinks(getExplorers(hreNetwork), deployData.contractAddress, receipt.hash);
    const chosenKey = await pickExplorer(hreNetwork);
    printLinks(chosenKey, allLinks);
  } else {
    console.log("Usage: npm run admin -- <command> [args]");
    console.log();
    console.log("Commands:");
    console.log("  info                          Show current contract state");
    console.log("  set-fee <job|rider> <bps>     Set fee in basis points");
    console.log("  set-fee-recipient <address>   Set fee recipient address");
    console.log("  add-token <address>           Whitelist an ERC-20 token");
    console.log("  remove-token <address>        Remove a token from support");
    console.log("  transfer-ownership <address>  Transfer contract ownership");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
