import Providers from './Providers.jsx';
import WalletConnect from './WalletConnect.jsx';
import JobList from './JobList.jsx';
import ConfirmDelivery from './ConfirmDelivery.jsx';

export default function RiderPage() {
  return (
    <Providers>
      <div style={{ padding: '2rem 1.5rem', maxWidth: '600px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Back</a>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '600', margin: '1rem 0' }}>Rider Dashboard</h1>
        <WalletConnect />
        <JobList />
        <hr />
        <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1rem' }}>Confirm Delivery</h2>
        <ConfirmDelivery />
      </div>
    </Providers>
  );
}
