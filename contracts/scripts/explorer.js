const readline = require("readline");

const EXPLORERS = {
  monadTestnet: {
    monadscan: { name: "Monadscan", base: "https://testnet.monadscan.com" },
    blockvision: { name: "MonadVision", base: "https://testnet.monadvision.com" },
  },
  monadMainnet: {
    monadscan: { name: "Monadscan", base: "https://monadscan.com" },
    blockvision: { name: "MonadVision", base: "https://monadvision.com" },
  },
};

function getExplorers(networkName) {
  return EXPLORERS[networkName] || EXPLORERS.monadMainnet;
}

function buildLinks(explorers, address, txHash) {
  const links = {};
  for (const [key, exp] of Object.entries(explorers)) {
    links[key] = {
      name: exp.name,
      contract: `${exp.base}/address/${address}`,
      tx: `${exp.base}/tx/${txHash}`,
    };
  }
  return links;
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function pickExplorer(networkName) {
  const explorers = getExplorers(networkName);
  const keys = Object.keys(explorers);

  console.log();
  console.log("Select block explorer:");
  keys.forEach((key, i) => {
    console.log(`  ${i + 1}) ${explorers[key].name} (${explorers[key].base})`);
  });

  const answer = await question("Choice [1]: ");
  const idx = answer === "" ? 0 : parseInt(answer, 10) - 1;
  if (idx < 0 || idx >= keys.length) {
    console.error("Invalid choice, defaulting to 1");
    return keys[0];
  }
  return keys[idx];
}

function printLinks(explorerKey, allLinks) {
  const link = allLinks[explorerKey];
  if (link) {
    console.log(`--- Explorer (${link.name}) ---`);
    console.log("Contract :", link.contract);
    console.log("TX       :", link.tx);
  }
}

module.exports = { EXPLORERS, getExplorers, buildLinks, pickExplorer, printLinks, question };
