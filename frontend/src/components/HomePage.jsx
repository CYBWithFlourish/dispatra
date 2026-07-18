import Providers from './Providers.jsx';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function HomePage() {
  return (
    <Providers>
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Dispatra</h1>
        <p style={{ color: '#999', fontSize: '1.1rem', marginBottom: '2rem' }}>
          On-chain delivery escrow on Monad
        </p>
        <div style={{ marginBottom: '2rem' }}>
          <ConnectButton />
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a
            href="/sender"
            style={{
              padding: '0.75rem 2rem',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500',
            }}
          >
            Sender
          </a>
          <a
            href="/rider"
            style={{
              padding: '0.75rem 2rem',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500',
            }}
          >
            Rider
          </a>
        </div>
      </div>
    </Providers>
  );
}
