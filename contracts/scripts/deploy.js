const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { buildLinks, pickExplorer, printLinks } = require("./explorer");

const CONTRACT_NAME = "DeliveryEscrow";

function getNetworkKey(hreNetwork) {
  if (hreNetwork === "monadTestnet" || hreNetwork === "testnet") return "TESTNET";
  if (hreNetwork === "monadMainnet" || hreNetwork === "mainnet") return "MAINNET";
  return hreNetwork.toUpperCase();
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);

  console.log("--- Deploy Info ---");
  console.log("Network  :", hre.network.name);
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", hre.ethers.formatEther(balance), "MON");
  console.log();

  const Contract = await hre.ethers.getContractFactory(CONTRACT_NAME);
  const contract = await Contract.deploy(deployer.address);
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();

  const address = await contract.getAddress();
  const allLinks = buildLinks(
    {
      monadscan: { name: "Monadscan", base: hre.network.name === "monadTestnet" ? "https://testnet.monadscan.com" : "https://monadscan.com" },
      blockvision: { name: "MonadVision", base: hre.network.name === "monadTestnet" ? "https://testnet.monadvision.com" : "https://monadvision.com" },
    },
    address,
    receipt.hash
  );

  console.log("--- Deployment Result ---");
  console.log("Contract :", CONTRACT_NAME);
  console.log("Address  :", address);
  console.log("TX Hash  :", receipt.hash);
  console.log("Gas Used :", receipt.gasUsed.toString());
  console.log("Block    :", receipt.blockNumber.toString());

  const chosenKey = await pickExplorer(hre.network.name);
  printLinks(chosenKey, allLinks);

  const networkKey = getNetworkKey(hre.network.name);
  const deployDir = path.join(__dirname, "..", `deployed.${networkKey}`);
  fs.mkdirSync(deployDir, { recursive: true });

  const deployData = {
    contractName: CONTRACT_NAME,
    contractAddress: address,
    network: networkKey,
    chainId: (await deployer.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployerBalance: hre.ethers.formatEther(balance) + " MON",
    deployTxHash: receipt.hash,
    deployBlock: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    explorerLinks: allLinks,
    config: {
      owner: deployer.address,
      feeRecipient: deployer.address,
      jobCreationFeeBps: (await contract.jobCreationFeeBps()).toString(),
      riderRegistrationFeeBps: (await contract.riderRegistrationFeeBps()).toString(),
      supportedTokens: ["0x0000000000000000000000000000000000000000"],
    },
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(deployDir, `${CONTRACT_NAME}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deployData, null, 2) + "\n");
  console.log();
  console.log("--- Deploy data saved ---");
  console.log("Path:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
