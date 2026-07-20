import { abi as CONTRACT_ABI } from "./abi.json";
import { CONTRACT_ADDRESS, RPC_URL, CHAIN_ID } from "./constants.js";

import { ethers } from "ethers";

export function getContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("PUBLIC_CONTRACT_ADDRESS is not set");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export function getWriteContract(signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("PUBLIC_CONTRACT_ADDRESS is not set");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}