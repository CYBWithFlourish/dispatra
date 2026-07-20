import Providers from './Providers.jsx';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Lock, MapPin, Zap, Shield, Globe, Unlock, ChevronRight, ArrowRight, Send, UserCheck, CircleCheck, ExternalLink } from 'lucide-react';

const features = [
  { icon: Lock, title: 'On-Chain Escrow', desc: 'Payment locked in smart contract until delivery confirmed. No middleman.', accent: '#22c55e' },
  { icon: MapPin, title: 'Private Locations', desc: 'Encrypted on-chain. Only parties see addresses. Privacy by default.', accent: '#3b82f6' },
  { icon: Zap, title: 'Instant Payout', desc: 'Rider gets paid the second recipient confirms. No waiting.', accent: '#f59e0b' },
  { icon: Shield, title: 'KYC Verified', desc: 'Sumsub-powered identity checks. Senders and riders verified.', accent: '#8b5cf6' },
  { icon: Globe, title: 'Multi-Token', desc: 'Pay with MON or USDC. Native and ERC-20 supported.', accent: '#06b6d4' },
  { icon: Unlock, title: 'Open or Designated', desc: 'Post open jobs for any rider, or assign a specific one.', accent: '#f97316' },
];

const flow = [
  { icon: Send, title: 'Sender creates job', desc: 'Enters pickup and delivery, sets payment, locks funds in escrow.' },
  { icon: UserCheck, title: 'Rider accepts', desc: 'Registered riders browse the marketplace and claim jobs.' },
  { icon: MapPin, title: 'Deliver', desc: 'Rider picks up and delivers. Recipient gets a 6-digit PIN.' },
  { icon: CircleCheck, title: 'Confirm & paid', desc: 'Recipient enters PIN on-chain. Rider gets paid instantly. Done.' },
];

const faqs = [
  { q: 'What is Dispatra?', a: 'Dispatra is a decentralized delivery escrow platform on Monad. Senders lock payment in a smart contract, and riders only get paid when the recipient confirms delivery on-chain using a unique PIN.' },
  { q: 'How does the escrow work?', a: 'When a sender creates a job, the payment is locked in the DeliveryEscrow smart contract. The funds stay locked until the recipient confirms delivery by submitting the correct PIN on-chain, at which point the rider is paid.' },
  { q: 'Is this on a real blockchain?', a: 'Yes. Dispatra runs on Monad \u2014 a high-performance L1 blockchain. All escrow logic, payments, and delivery confirmations happen on-chain.' },
  { q: 'What tokens are accepted?', a: 'Currently MON (Monad native token) and USDC. The contract supports any ERC-20 token that the contract owner adds.' },
  { q: 'What is KYC and why is it required?', a: 'KYC (Know Your Customer) via Sumsub verifies the identity of senders and riders. This prevents fraud and builds trust in the marketplace.' },
  { q: 'How are locations kept private?', a: 'Pickup and delivery locations are encrypted with AES-256-GCM before being stored. Only a hash of the location appears on-chain, so the blockchain never sees plaintext addresses.' },
  { q: 'Can a rider refuse a delivery?', a: 'Riders choose which jobs to accept. Once accepted, the rider is committed. If the delivery cannot be completed, the sender can cancel and get a refund before the deadline.' },
];

export default function HomePage() {
  return (
    <Providers>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontWeight: '700', fontSize: '1.3rem', color: '#ededed' }}>Dispatra</div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#features" style={{ color: '#999', textDecoration: 'none', fontSize: '0.9rem' }}>Features</a>
          <a href="#how" style={{ color: '#999', textDecoration: 'none', fontSize: '0.9rem' }}>How It Works</a>
          <a href="#faq" style={{ color: '#999', textDecoration: 'none', fontSize: '0.9rem' }}>FAQ</a>
          <ConnectButton />
        </div>
      </nav>

      <section style={{ padding: '6rem 2rem 4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#052e16', color: '#22c55e', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          On Monad Testnet
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: '800', lineHeight: '1.1', marginBottom: '1rem', textWrap: 'balance' }}>
          Delivery Escrow,<br />
          <span style={{ color: '#3b82f6' }}>Trustlessly.</span>
        </h1>
        <p style={{ color: '#999', fontSize: '1.15rem', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: '1.6' }}>
          Sender locks payment. Rider delivers. Recipient confirms. Smart contract pays.
          No middleman. No disputes. Just code.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/sender" style={{ background: '#3b82f6', color: 'white', padding: '0.85rem 2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.15s' }}>
            Create a Delivery <ChevronRight size={18} />
          </a>
          <a href="/rider" style={{ background: '#1a1a1a', color: '#ededed', padding: '0.85rem 2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '1rem', border: '1px solid #333', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'border-color 0.15s' }}>
            Start Riding <ChevronRight size={18} />
          </a>
        </div>
      </section>

      <section style={{ padding: '3rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '2rem' }}>
          {[
            { value: '1.2%', label: 'Platform fee (job creation)', color: '#22c55e' },
            { value: '<1s', label: 'Confirmation time', color: '#3b82f6' },
            { value: '2', label: 'Tokens accepted (MON, USDC)', color: '#f59e0b' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ textAlign: 'center', flex: '1 1 200px' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: '700', color: stat.color, lineHeight: '1' }}>{stat.value}</div>
              <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.35rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" style={{ padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '700', marginBottom: '3rem', textWrap: 'balance' }}>Why Dispatra</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '10px',
                padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <div style={{ color: f.accent }}><Icon size={18} /></div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600' }}>{f.title}</h3>
                </div>
                <p style={{ color: '#999', fontSize: '0.85rem', lineHeight: '1.5' }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="how" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '700', marginBottom: '3rem', textWrap: 'balance' }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          {flow.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '10px',
                padding: '1.5rem',
                textAlign: 'center',
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: '#1a1a2e', marginBottom: '0.75rem' }}>
                  <Icon size={18} style={{ color: '#3b82f6' }} />
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.35rem' }}>{s.title}</h3>
                <p style={{ color: '#999', fontSize: '0.8rem', lineHeight: '1.5' }}>{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="faq" style={{ padding: '4rem 2rem', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '700', marginBottom: '3rem', textWrap: 'balance' }}>FAQ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faqs.map((f) => (
            <details key={f.q} style={{ background: '#111', border: '1px solid #222', borderRadius: '8px', padding: '0.85rem 1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#ededed', listStyle: 'none' }}>{f.q}</summary>
              <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.6rem', lineHeight: '1.6' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section style={{ padding: '4rem 2rem', textAlign: 'center', background: '#0a1628', marginTop: '4rem' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '700', marginBottom: '1rem' }}>Ready to deliver trustlessly?</h2>
        <p style={{ color: '#999', marginBottom: '2rem' }}>Connect your wallet and create your first on-chain delivery.</p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <ConnectButton />
        </div>
      </section>

      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          Built on Monad | Smart contract escrow | No middleman
        </p>
        <p style={{ color: '#444', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Dispatra &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </Providers>
  );
}
