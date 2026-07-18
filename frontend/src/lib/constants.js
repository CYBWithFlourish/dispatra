const NETWORK = (import.meta.env.PUBLIC_MONAD_NETWORK || 'TESTNET').toUpperCase();

export const CONTRACT_ADDRESS = import.meta.env[`PUBLIC_CONTRACT_ADDRESS_${NETWORK}`];
export const RPC_URL = import.meta.env[`PUBLIC_RPC_URL_${NETWORK}`] || 'https://testnet-rpc.monad.xyz';
export const CHAIN_ID = parseInt(import.meta.env[`PUBLIC_CHAIN_ID_${NETWORK}`] || '10143');
export { NETWORK };
