require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const KEYPAIR_PRIVATE_KEY = process.env.KEYPAIR_PRIVATE_KEY;
const MONAD_TESTNET_RPC_URL = process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";
const MONAD_MAINNET_RPC_URL = process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz";

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    monadTestnet: {
      url: MONAD_TESTNET_RPC_URL,
      chainId: 10143,
      accounts: KEYPAIR_PRIVATE_KEY ? [KEYPAIR_PRIVATE_KEY] : [],
    },
    monadMainnet: {
      url: MONAD_MAINNET_RPC_URL,
      chainId: 143,
      accounts: KEYPAIR_PRIVATE_KEY ? [KEYPAIR_PRIVATE_KEY] : [],
    },
  },
};
