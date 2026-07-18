import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from '../lib/constants.js';
import CONTRACT_ABI from '../lib/abi.json';

export default function ConfirmDelivery() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        type="number"
        placeholder="Job ID"
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        required
      />
      <input
        placeholder="Confirmation Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <button type="submit" disabled={loading || !address}>
        {loading ? 'Confirming...' : 'Confirm Delivery'}
      </button>
      {status && (
        <p style={{ color: status.startsWith('Error') ? '#ef4444' : '#22c55e', fontSize: '0.9rem', wordBreak: 'break-all' }}>
          {status}
        </p>
      )}
    </form>
  );
}
