import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, RPC_URL } from '../lib/constants.js';
import { abi as CONTRACT_ABI } from '../lib/abi.json';
import { api } from '../lib/api.js';
import MapView from './MapView.jsx';
import { MONAD_CENTER, MARKETPLACE_ZOOM, PIN_COLORS } from '../lib/mapConfig.js';
import { Map, List, RefreshCw, MapPin, Clock, Coins, User, CheckCircle, Wallet } from 'lucide-react';

const STATUS_MAP = ['Open', 'Accepted', 'Completed', 'Refunded', 'Cancelled'];
const STATUS_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#666'];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatDeadline(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 0) return 'Expired';
  if (diffHours < 1) return 'Less than 1h';
  if (diffHours < 24) return `${diffHours}h left`;
  const days = Math.floor(diffHours / 24);
  return `${days}d left`;
}

async function fetchJobsFromChain() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const total = await contract.jobCounter();
  const jobs = [];
  for (let i = 0; i < Number(total); i++) {
    const job = await contract.getJob(i);
    if (job.status === 0 || job.status === 1) {
      jobs.push({ id: i, ...job });
    }
  }
  return jobs;
}

async function fetchJobsFromApi() {
  try {
    const data = await api.jobs.list({ status: 'created', limit: 50 });
    return data.jobs.map((j) => ({
      id: j.job_id,
      sender: j.sender,
      recipient: j.recipient,
      rider: j.rider || ZERO_ADDRESS,
      amount: ethers.parseEther(j.amount),
      status: j.status === 'created' ? 0 : j.status === 'accepted' ? 1 : parseInt(j.status),
      token: j.token,
      deadline: j.deadline ? BigInt(Math.floor(new Date(j.deadline).getTime() / 1000)) : BigInt(0),
    }));
  } catch {
    return null;
  }
}

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('map');
  const [selectedJob, setSelectedJob] = useState(null);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const loadJobs = async () => {
    setLoading(true);
    try {
      const apiJobs = await fetchJobsFromApi();
      if (apiJobs && apiJobs.length > 0) {
        setJobs(apiJobs);
      } else {
        const chainJobs = await fetchJobsFromChain();
        setJobs(chainJobs);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
      try {
        const chainJobs = await fetchJobsFromChain();
        setJobs(chainJobs);
      } catch {
        setJobs([]);
      }
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

  const mapMarkers = jobs.map((job) => {
    const isOpen = job.status === 0;
    const color = isOpen ? PIN_COLORS.job : PIN_COLORS.accepted;
    const pos = {
      lat: MONAD_CENTER.lat + (Number(job.id) * 0.007 % 0.05) - 0.025,
      lng: MONAD_CENTER.lng + (Number(job.id) * 0.011 % 0.05) - 0.025,
    };
    return {
      ...pos,
      color,
      label: `${job.id}`,
      popup: `<div style="min-width:160px;"><b>#${job.id}</b> ${STATUS_MAP[job.status]}<br/>${ethers.formatEther(job.amount)} MON</div>`,
      jobId: job.id,
    };
  });

  const toggleStyle = (active) => ({
    width: 'auto',
    padding: '0.4rem 0.85rem',
    background: active ? '#3b82f6' : '#222',
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setView('map')} style={toggleStyle(view === 'map')}>
          <Map size={14} /> Map
        </button>
        <button onClick={() => setView('list')} style={toggleStyle(view === 'list')}>
          <List size={14} /> List
        </button>
        <button onClick={loadJobs} disabled={loading} style={{ ...toggleStyle(false), opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {!address && (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
          <Wallet size={20} style={{ color: '#666', marginBottom: '0.5rem' }} />
          <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Connect wallet to accept jobs</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectButton />
          </div>
        </div>
      )}

      {view === 'map' && (
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #222', marginBottom: '1rem' }}>
          <MapView
            center={MONAD_CENTER}
            zoom={MARKETPLACE_ZOOM}
            markers={mapMarkers}
            height="450px"
            onMarkerClick={(m) => {
              const job = jobs.find((j) => j.id === m.jobId);
              setSelectedJob(job);
              setView('list');
            }}
          />
        </div>
      )}

      {view === 'list' && (
        <div>
          {jobs.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <MapPin size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
              <p>No open jobs yet</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Jobs created by senders will appear here</p>
            </div>
          )}
          {jobs.map((job) => {
            const isOpen = job.status === 0;
            const isDesignated = job.rider !== ZERO_ADDRESS;
            const amountEth = ethers.formatEther(job.amount);
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                style={{
                  border: `1px solid ${selectedJob?.id === job.id ? '#3b82f6' : '#222'}`,
                  padding: '1rem 1.25rem',
                  margin: '0.5rem 0',
                  borderRadius: '10px',
                  background: selectedJob?.id === job.id ? '#0a1628' : '#111',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>Job #{job.id}</strong>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    color: STATUS_COLORS[job.status],
                    background: `${STATUS_COLORS[job.status]}15`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}>
                    {isOpen && <CheckCircle size={10} />}
                    {STATUS_MAP[job.status]}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={12} /> {job.sender.slice(0, 6)}...{job.sender.slice(-4)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: isDesignated ? '#f59e0b' : '#22c55e' }}>
                    <MapPin size={12} /> {isDesignated ? 'Designated' : 'Open'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#ededed', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}>
                    <Coins size={13} /> {amountEth} MON
                  </span>
                  <span style={{ color: '#666', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={13} /> {formatDeadline(job.deadline)}
                  </span>
                </div>

                {isOpen && (
                  <button
                    onClick={(e) => { e.stopPropagation(); acceptJob(job.id); }}
                    disabled={isDesignated && job.rider.toLowerCase() !== address?.toLowerCase()}
                    style={{
                      marginTop: '0.75rem',
                      width: 'auto',
                      padding: '0.5rem 1.5rem',
                      opacity: isDesignated && job.rider.toLowerCase() !== address?.toLowerCase() ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    {isDesignated ? 'Accept (Designated)' : 'Accept Job'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
