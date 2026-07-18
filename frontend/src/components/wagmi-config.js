import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadTestnet, monad } from 'wagmi/chains';

export default getDefaultConfig({
  appName: 'Dispatra',
  projectId: import.meta.env.WALLETCONNECT_PROJECT_ID || 'dispatra-monad',
  chains: [monadTestnet, monad],
  ssr: true,
});
