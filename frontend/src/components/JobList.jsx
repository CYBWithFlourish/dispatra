import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, RPC_URL } from '../lib/constants.js';
import CONTRACT_ABI from '../lib/abi.json';

const STATUS_MAP = ['Open', 'Accepted', 'Completed', 'Refunded', 'Cancelled'];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const loadJobs = async () => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const total = await contract.jobCounter();

      const openJobs = [];
      for (let i = 0; i < Number(total); i++) {
        const job = await contract.getJob(i);
        if (job.status === 0 || job.status === 1) {
          openJobs.push({ id: i, ...job });
        }
      }
      setJobs(openJobs);
    } catch (err) {
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const acceptJob = async (jobId) => {
    if (!walletClient) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.acceptJob(jobId);
      await tx.wait();
      alert('Job accepted!');
      loadJobs();
    } catch (err) {
      alert(`Error: ${err.reason || err.message || err}`);
    }
  };

  return (
    <div>
      <button onClick={loadJobs} disabled={loading} style={{ marginBottom: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>
        {loading ? 'Loading...' : 'Refresh Jobs'}
      </button>
      {jobs.length === 0 && !loading && <p style={{ color: '#666' }}>No open jobs.</p>}
      {jobs.map((job) => (
        <div key={job.id} style={{ border: '1px solid #333', padding: '1rem', margin: '0.75rem 0', borderRadius: '8px', background: '#111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong>Job #{job.id}</strong>
            <span style={{ fontSize: '0.8rem', color: job.status === 0 ? '#22c55e' : '#f59e0b', background: job.status === 0 ? '#052e16' : '#422006', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {STATUS_MAP[job.status]}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#999' }}>Sender: {job.sender.slice(0, 6)}...{job.sender.slice(-4)}</p>
          <p style={{ fontSize: '0.85rem', color: '#999' }}>
            Rider: {job.rider === ZERO_ADDRESS ? <span style={{ color: '#22c55e' }}>Open (any registered rider)</span> : `${job.rider.slice(0, 6)}...${job.rider.slice(-4)}`}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#ededed' }}>Amount: {ethers.formatEther(job.amount)} MON</p>
          <p style={{ fontSize: '0.85rem', color: '#999' }}>Deadline: {new Date(Number(job.deadline) * 1000).toLocaleString()}</p>
          {job.status === 0 && (
            <button
              onClick={() => acceptJob(job.id)}
              disabled={job.rider !== ZERO_ADDRESS && job.rider.toLowerCase() !== address?.toLowerCase()}
              style={{ marginTop: '0.75rem', width: 'auto', padding: '0.5rem 1.5rem', opacity: job.rider !== ZERO_ADDRESS && job.rider.toLowerCase() !== address?.toLowerCase() ? 0.4 : 1 }}
            >
              {job.rider === ZERO_ADDRESS ? 'Accept Job' : 'Accept (Designated Rider)'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
