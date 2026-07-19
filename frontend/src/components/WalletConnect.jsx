import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from './AuthProvider.jsx';
import { LogOut, Loader2, ChevronDown } from 'lucide-react';

export default function WalletConnect() {
  const { user, loggingIn, login, logout, isConnected } = useAuth();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <ConnectButton
        chainStatus="icon"
        showBalance={false}
        accountStatus="address"
      />
      {isConnected && user && (
        <button
          onClick={logout}
          style={{
            width: 'auto',
            padding: '0.4rem 0.75rem',
            background: '#222',
            border: '1px solid #333',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            color: '#999',
            cursor: 'pointer',
          }}
        >
          <LogOut size={12} /> Sign Out
        </button>
      )}
    </div>
  );
}
