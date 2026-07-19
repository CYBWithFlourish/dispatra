const { ethers } = require('ethers');
const path = require('path');

const ABI_PATH = path.join(__dirname, '../../../contracts/artifacts/contracts/DeliveryEscrow.sol/DeliveryEscrow.json');

let provider;
let contract;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  }
  return provider;
}

function getContract() {
  if (!contract) {
    const abi = require(ABI_PATH).abi;
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, getProvider());
  }
  return contract;
}

async function getJobFromChain(jobId) {
  const c = getContract();
  const job = await c.getJob(jobId);
  const pin = await c.getJobPin(jobId);
  return {
    jobId: Number(jobId),
    sender: job.sender,
    recipient: job.recipient,
    rider: job.rider,
    amount: job.amount.toString(),
    token: job.token,
    status: ['created', 'accepted', 'completed', 'refunded', 'cancelled'][Number(job.status)],
    deadline: new Date(Number(job.deadline) * 1000),
    confirmationCodeHash: job.confirmationCodeHash,
    pickupLocationHash: job.pickupLocationHash,
    deliveryLocationHash: job.deliveryLocationHash,
    pin: pin || null,
  };
}

async function getJobCounter() {
  const c = getContract();
  const count = await c.jobCounter();
  return Number(count);
}

module.exports = { getProvider, getContract, getJobFromChain, getJobCounter };
