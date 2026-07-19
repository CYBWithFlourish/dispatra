import Providers from './Providers.jsx';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import JobList from './JobList.jsx';
import ConfirmDelivery from './ConfirmDelivery.jsx';
import KycVerification from './KycVerification.jsx';
import { Bike, ArrowLeft, CircleCheck } from 'lucide-react';

function RiderContent() {
  const { address } = useAccount();
  
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <a href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back
      </a>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Bike size={20} style={{ color: '#22c55e' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Rider Marketplace</h1>
        </div>
        <ConnectButton />
      </div>
      
      {address && <KycVerification role="rider" />}
      <JobList />
      
      <div style={{ borderTop: '1px solid #222', marginTop: '2rem', paddingTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <CircleCheck size={18} style={{ color: '#3b82f6' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Confirm Delivery</h2>
        </div>
        <ConfirmDelivery />
      </div>
    </div>
  );
}

export default function RiderPage() {
  return (
    <Providers>
      <RiderContent />
    </Providers>
  );
}
