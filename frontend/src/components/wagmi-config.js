import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
    public: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.com' },
  },
  testnet: true,
};

const monadMainnet = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
    public: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://monadscan.com' },
  },
};

export default getDefaultConfig({
  appName: 'Dispatra',
  projectId: import.meta.env.PUBLIC_WALLETCONNECT_PROJECT_ID || 'dispatra-demo',
  chains: [monadTestnet, monadMainnet],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
    [monadMainnet.id]: http('https://rpc.monad.xyz'),
  },
  ssr: true,
});
