import Providers from './Providers.jsx';
import WalletConnect from './WalletConnect.jsx';
import JobCreateForm from './JobCreateForm.jsx';

export default function SenderPage() {
  return (
    <Providers>
      <div style={{ padding: '2rem 1.5rem', maxWidth: '600px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Back</a>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '600', margin: '1rem 0' }}>Create Delivery Job</h1>
        <WalletConnect />
        <JobCreateForm />
      </div>
    </Providers>
  );
}
