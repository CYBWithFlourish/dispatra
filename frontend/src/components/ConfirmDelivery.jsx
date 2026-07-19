import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from '../lib/constants.js';
import CONTRACT_ABI from '../lib/abi.json';
import { api } from '../lib/api.js';
import { useAuth } from './AuthProvider.jsx';
import { KeyRound, CircleCheck, AlertCircle, Wallet, Loader2 } from 'lucide-react';

export default function ConfirmDelivery() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { user, login, loggingIn } = useAuth();
  const [jobId, setJobId] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletClient) {
      setStatus('Please connect your wallet first');
      return;
    }
    if (!user) {
      setStatus('Please sign in first');
      return;
    }

    setLoading(true);
    setStatus('Confirming delivery...');

    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.confirmDelivery(parseInt(jobId), code);
      await tx.wait();
      setStatus('Delivery confirmed! Rider paid.');
      setJobId('');
      setCode('');
    } catch (err) {
      setStatus(`Error: ${err.reason || err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
        <Wallet size={20} style={{ color: '#666', marginBottom: '0.5rem' }} />
        <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Connect wallet to confirm delivery</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '1rem' }}>Sign in to confirm delivery</p>
        <button onClick={login} disabled={loggingIn} style={{ width: 'auto', padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          {loggingIn ? <><Loader2 size={14} className="spin" /> Signing...</> : 'Sign In with Ethereum'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        type="number"
        placeholder="Job ID"
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        required
      />
      <div style={{ position: 'relative' }}>
        <input
          placeholder="6-digit confirmation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={6}
          style={{ paddingLeft: '2.25rem', fontFamily: 'monospace', letterSpacing: '0.15em', fontSize: '1.1rem' }}
        />
        <KeyRound size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
      </div>
      <button type="submit" disabled={loading || !address || !user} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        {loading ? (
          <><Loader2 size={14} className="spin" /> Confirming...</>
        ) : (
          <>
            <CircleCheck size={16} />
            Confirm Delivery
          </>
        )}
      </button>
      {status && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          borderRadius: '6px',
          fontSize: '0.85rem',
          background: status.startsWith('Error') ? '#2a0a0a' : '#052e16',
          color: status.startsWith('Error') ? '#ef4444' : '#22c55e',
        }}>
          {status.startsWith('Error') ? <AlertCircle size={14} /> : <CircleCheck size={14} />}
          {status}
        </div>
      )}
    </form>
  );
}
