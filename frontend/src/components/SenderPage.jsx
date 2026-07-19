import Providers from './Providers.jsx';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import JobCreateForm from './JobCreateForm.jsx';
import KycVerification from './KycVerification.jsx';
import { Package, ArrowLeft } from 'lucide-react';

function SenderContent() {
  const { address } = useAccount();
  
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      <a href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back
      </a>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Package size={20} style={{ color: '#3b82f6' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Create Delivery</h1>
        </div>
        <ConnectButton />
      </div>
      
      {address && <KycVerification role="sender" />}
      <JobCreateForm />
    </div>
  );
}

export default function SenderPage() {
  return (
    <Providers>
      <SenderContent />
    </Providers>
  );
}
