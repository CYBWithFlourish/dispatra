import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from '../lib/constants.js';
import CONTRACT_ABI from '../lib/abi.json';

export default function JobCreateForm() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipient: '',
    rider: '',
    code: '',
    duration: '',
    amount: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletClient) {
      setStatus('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setStatus('Creating job...');

    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const codeHash = ethers.keccak256(ethers.toUtf8Bytes(formData.code));
      const amount = ethers.parseEther(formData.amount);
      const riderAddr = formData.rider.trim() || ethers.ZeroAddress;

      const tx = await contract.createJob(
        formData.recipient,
        riderAddr,
        codeHash,
        parseInt(formData.duration),
        '0x0000000000000000000000000000000000000000',
        { value: amount }
      );

      await tx.wait();
      setStatus(`Job created! TX: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`);
      setFormData({ recipient: '', rider: '', code: '', duration: '', amount: '' });
    } catch (err) {
      setStatus(`Error: ${err.reason || err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        placeholder="Recipient Address (0x...)"
        value={formData.recipient}
        onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
        required
      />
      <input
        placeholder="Rider Address (optional — leave empty for open job)"
        value={formData.rider}
        onChange={(e) => setFormData({ ...formData, rider: e.target.value })}
      />
      <input
        placeholder="Confirmation Code"
        value={formData.code}
        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
        required
      />
      <input
        type="number"
        placeholder="Duration (minutes)"
        value={formData.duration}
        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Amount (MON)"
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        required
      />
      <button type="submit" disabled={loading || !address}>
        {loading ? 'Creating...' : 'Create Job'}
      </button>
      {status && (
        <p style={{ color: status.startsWith('Error') ? '#ef4444' : '#22c55e', fontSize: '0.9rem', wordBreak: 'break-all' }}>
          {status}
        </p>
      )}
    </form>
  );
}
