import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { SiweMessage } from 'siwe';
import { useAuth } from './AuthProvider.jsx';
import { api } from '../lib/api.js';
import { Shield, ShieldCheck, ShieldX, ShieldAlert, Loader2, ExternalLink, ArrowUp, Wallet } from 'lucide-react';

const SDK_URL = 'https://static.sumsub.com/idensify/web-sdk/3.3.15-0/web-sdk.js';
const POLL_INTERVAL = 3000;
const MAX_POLLS = 40;

const STATUS_CONFIG = {
  none: { icon: Shield, color: '#666', bg: '#1a1a1a', label: 'Not Verified', desc: 'Verify your wallet to start using Dispatra.' },
  pending: { icon: ShieldAlert, color: '#eab308', bg: '#1c1a0a', label: 'Verification Pending', desc: 'Your documents are being reviewed. This usually takes a few minutes.' },
  verified: { icon: ShieldCheck, color: '#22c55e', bg: '#0a1c10', label: 'Verified', desc: 'Your identity has been confirmed.' },
  rejected: { icon: ShieldX, color: '#ef4444', bg: '#1c0a0a', label: 'Verification Failed', desc: 'Your verification was rejected. Please try again with clearer documents.' },
};

const DOC_INFO = {
  sender: { title: 'National ID', desc: "You'll need a valid national ID card. Make sure all text and photos are clearly visible." },
  rider: { title: "NIN + Driver's License", desc: "You'll need your National Identification Number (NIN) and a valid driver's license. Both documents must be current and unexpired." },
};

const LEVEL_LABELS = {
  'none': 'Not verified',
  'wallet': 'Wallet Verified',
  'national-id': 'National ID',
  'nin-and-license': 'NIN + Driver\'s License',
};

const LEVEL_ORDER = { 'none': 0, 'wallet': 1, 'national-id': 2, 'nin-and-license': 3 };

function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.SumsubIdensify) { resolve(); return; }
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function KycVerification({ role = 'sender' }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const { user, login } = useAuth();
  const widgetRef = useRef(null);
  const pollRef = useRef(null);

  const [walletVerified, setWalletVerified] = useState(user?.walletVerified || false);
  const [kycStatus, setKycStatus] = useState(user?.kycStatus || 'none');
  const [kycLevel, setKycLevel] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [widgetActive, setWidgetActive] = useState(false);

  const requiredLevel = role === 'rider' ? 'nin-and-license' : 'national-id';
  const isLevelOk = (LEVEL_ORDER[kycLevel] || 0) >= (LEVEL_ORDER[requiredLevel] || 0);
  const needsUpgrade = kycStatus === 'verified' && !isLevelOk;

  useEffect(() => {
    if (user?.walletVerified !== undefined) setWalletVerified(user.walletVerified);
    if (user?.kycStatus) setKycStatus(user.kycStatus);
  }, [user?.walletVerified, user?.kycStatus]);

  useEffect(() => {
    loadSdk().then(() => setSdkReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!address) return;
    api.kyc.status(address).then((res) => {
      if (res.level) setKycLevel(res.level);
      if (res.status) setKycStatus(res.status);
      if (res.walletVerified !== undefined) setWalletVerified(res.walletVerified);
    }).catch(() => {});
  }, [address]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const pollStatus = useCallback(() => {
    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      try {
        const res = await api.kyc.status(address);
        const status = res.status || res.kycStatus;
        if (res.level) setKycLevel(res.level);
        if (status && status !== kycStatus) {
          setKycStatus(status);
          setWidgetActive(false);
          stopPolling();
          login();
        }
      } catch { /* keep polling */ }
      if (count >= MAX_POLLS) stopPolling();
    }, POLL_INTERVAL);
  }, [address, kycStatus, login, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleWalletVerify = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const nonceRes = await api.auth.nonce(address);
      const origin = window.location.origin;
      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Dispatra',
        uri: origin,
        version: '1',
        chainId,
        nonce: nonceRes.nonce,
      });
      const message = siwe.prepareMessage();
      const signature = await signMessageAsync({ message });
      await api.auth.verifyWallet(message, signature);
      setWalletVerified(true);
      login();
    } catch (err) {
      setError(err.message || 'Failed to verify wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKycVerify = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.kyc.createApplicant(role);
      if (result.alreadyVerified || result.alreadyPending) {
        setKycStatus('verified');
        setWidgetActive(false);
        setLoading(false);
        return;
      }
      const { token } = await api.kyc.token(address);
      setKycStatus('pending');
      if (result.level) setKycLevel(result.level);
      login();

      await loadSdk();
      setWidgetActive(true);

      setTimeout(() => {
        if (!widgetRef.current) return;
        window.SumsubIdensify.init('#sumsub-widget', token, {
          onReady: () => {},
          onDone: () => { pollStatus(); },
          onError: (err) => { setError('Verification error. Please try again.'); setWidgetActive(false); console.error('Sumsub error:', err); },
        });
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to start verification. Please try again.');
      setWidgetActive(false);
    } finally {
      setLoading(false);
    }
  };

  const config = walletVerified ? STATUS_CONFIG.verified : STATUS_CONFIG.none;
  const StatusIcon = config.icon;
  const docInfo = DOC_INFO[role];

  const showWalletButton = !walletVerified;
  const showKycButton = walletVerified && !isLevelOk;

  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <StatusIcon size={18} style={{ color: config.color }} />
          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#eee' }}>Identity Verification</span>
        </div>
        <span style={{
          fontSize: '0.75rem', fontWeight: '600', padding: '0.2rem 0.6rem',
          borderRadius: '9999px', color: config.color, background: config.bg,
          border: `1px solid ${config.color}22`,
        }}>
          {walletVerified ? 'Verified' : 'Not Verified'}
        </span>
      </div>

      {kycLevel !== 'none' && (
        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
          Current level: <span style={{ color: '#aaa' }}>{LEVEL_LABELS[kycLevel]}</span>
        </div>
      )}

      <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
        {walletVerified
          ? 'Your wallet is verified. You can create deliveries and accept jobs.'
          : 'Sign a message with your wallet to verify ownership. No documents required.'}
      </p>

      {!walletVerified && (
        <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #1a1a1a' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#aaa', margin: '0 0 0.3rem 0' }}>
            How it works
          </p>
          <p style={{ fontSize: '0.78rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
            Click verify, sign a message in your wallet. That's it — no documents, no waiting.
          </p>
        </div>
      )}

      {walletVerified && needsUpgrade && (
        <div style={{ background: '#0a1628', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #1e3a5f' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#3b82f6', margin: '0 0 0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ArrowUp size={12} /> Level Upgrade Required
          </p>
          <p style={{ fontSize: '0.78rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
            You have {LEVEL_LABELS[kycLevel]} verification. Riders need {LEVEL_LABELS[requiredLevel]} verification.
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: '#1c0a0a', border: '1px solid #ef444422', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      )}

      {showWalletButton && (
        <button
          onClick={handleWalletVerify}
          disabled={loading}
          style={{
            width: '100%', padding: '0.65rem', borderRadius: '8px', border: 'none',
            background: loading ? '#222' : '#3b82f6',
            color: loading ? '#666' : '#fff',
            fontSize: '0.85rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Wallet size={14} />}
          {loading ? 'Verifying...' : 'Verify Wallet'}
        </button>
      )}

      {showKycButton && (
        <button
          onClick={handleKycVerify}
          disabled={loading || !sdkReady}
          style={{
            width: '100%', padding: '0.65rem', borderRadius: '8px', border: 'none',
            background: loading || !sdkReady ? '#222' : needsUpgrade ? '#f59e0b' : '#22c55e',
            color: loading || !sdkReady ? '#666' : '#fff',
            fontSize: '0.85rem', fontWeight: '600', cursor: loading || !sdkReady ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : needsUpgrade ? <ArrowUp size={14} /> : <ExternalLink size={14} />}
          {loading ? 'Preparing...' : needsUpgrade ? `Upgrade to ${ROLE_LABELS[role]} Verification` : 'Upgrade to Full KYC'}
        </button>
      )}

      <div
        id="sumsub-widget"
        ref={widgetRef}
        style={{ display: widgetActive ? 'block' : 'none', marginTop: '0.75rem', minHeight: widgetActive ? '400px' : '0' }}
      />

      {widgetActive && (
        <button
          onClick={() => { setWidgetActive(false); }}
          style={{
            marginTop: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '6px',
            border: '1px solid #333', background: 'transparent', color: '#888',
            fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          Close Widget
        </button>
      )}

      {kycStatus === 'pending' && (
        <p style={{ fontSize: '0.78rem', color: '#eab308', margin: '0.5rem 0 0 0', textAlign: 'center' }}>
          Checking for updates...
        </p>
      )}
    </div>
  );
}

const ROLE_LABELS = { sender: 'Sender', rider: 'Rider' };
