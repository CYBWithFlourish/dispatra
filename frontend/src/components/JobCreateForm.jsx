import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from '../lib/constants.js';
import CONTRACT_ABI from '../lib/abi.json';
import { api } from '../lib/api.js';
import { useAuth } from './AuthProvider.jsx';
import MapView from './MapView.jsx';
import LocationSearch from './LocationSearch.jsx';
import useRoute from '../lib/useRoute.js';
import useMonPrice from '../lib/useMonPrice.js';
import { MONAD_CENTER, PIN_COLORS, PRICING_USD, calculateDistanceFee, getDistanceTierLabel } from '../lib/mapConfig.js';
import { Send, MapPin, Clock, Coins, KeyRound, Route, Truck, DollarSign, AlertTriangle, Wallet, Loader2 } from 'lucide-react';

function formatDuration(seconds) {
  if (seconds < 60) return '<1 min';
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function usdToMon(usd, monUsd) {
  if (!monUsd || monUsd <= 0) return 0;
  return usd / monUsd;
}

function estimatePrice(distanceKm, monUsd) {
  const baseUsd = PRICING_USD.baseFeeUsd;
  const distanceFeeUsd = calculateDistanceFee(distanceKm);
  const subtotalUsd = baseUsd + distanceFeeUsd;
  const platformFeePct = PRICING_USD.platformFeeBps / 10000;
  const platformFeeUsd = subtotalUsd * platformFeePct;
  const riderReceivesUsd = subtotalUsd;
  const totalUsd = subtotalUsd + platformFeeUsd;

  const totalMon = Math.round(usdToMon(totalUsd, monUsd) * 10000) / 10000;
  const minMon = Math.round(usdToMon(baseUsd * (1 + platformFeePct), monUsd) * 10000) / 10000;

  return {
    baseUsd,
    distanceFeeUsd,
    tierLabel: getDistanceTierLabel(distanceKm),
    platformFeeUsd,
    platformFeePct: (platformFeePct * 100).toFixed(1),
    riderReceivesUsd,
    totalUsd,
    totalMon,
    minMon,
  };
}

function getPriceStatus(amount, pricing) {
  if (!pricing || !amount) return null;
  const val = parseFloat(amount);
  if (isNaN(val) || val <= 0) return null;
  if (val < pricing.minMon) return 'below';
  if (val > pricing.totalMon * 3) return 'high';
  if (val >= pricing.totalMon * 0.8) return 'good';
  return 'low';
}

export default function JobCreateForm() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { user, login, loggingIn } = useAuth();
  const [status, setStatus] = useState('');
  const [createdPin, setCreatedPin] = useState('');
  const [createdJobId, setCreatedJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickup, setPickup] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [formData, setFormData] = useState({
    recipient: '',
    rider: '',
    duration: '',
    amount: '',
  });

  const { route, loading: routeLoading } = useRoute(pickup, delivery);
  const { monUsd, loading: priceLoading } = useMonPrice();

  const pricing = useMemo(() => {
    if (!route) return null;
    return estimatePrice(route.distanceKm, monUsd);
  }, [route, monUsd]);

  const markers = [];
  if (pickup) markers.push({ ...pickup, color: PIN_COLORS.pickup, label: 'P', popup: 'Pickup' });
  if (delivery) markers.push({ ...delivery, color: PIN_COLORS.delivery, label: 'D', popup: 'Delivery' });

  const mapCenter = pickup || delivery || MONAD_CENTER;

  const handlePickupSelect = useCallback((loc) => setPickup(loc), []);
  const handleDeliverySelect = useCallback((loc) => setDelivery(loc), []);

  useEffect(() => {
    if (route && route.durationMin) {
      const suggestedDuration = Math.max(route.durationMin * 2, 30);
      setFormData((prev) => ({
        ...prev,
        duration: prev.duration || suggestedDuration.toString(),
      }));
    }
  }, [route]);

  const priceStatus = useMemo(() => getPriceStatus(formData.amount, pricing), [formData.amount, pricing]);

  const applySuggestedPrice = () => {
    if (pricing) {
      setFormData({ ...formData, amount: pricing.totalMon.toString() });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletClient) {
      setStatus('Please connect your wallet first');
      return;
    }
    if (!user) {
      setStatus('Please sign in first');
      return;
    }

    setLoading(true);
    setStatus('Creating job...');
    setCreatedPin('');
    setCreatedJobId('');

    try {
      const amountNum = parseFloat(formData.amount);
      if (pricing && amountNum < pricing.minMon) {
        setStatus(`Error: Price too low. Minimum is $${pricing.baseUsd.toFixed(2)} USD (${pricing.minMon} MON).`);
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const amount = ethers.parseEther(formData.amount);
      const riderAddr = formData.rider.trim() || ethers.ZeroAddress;

      const pickupStr = pickup ? `${pickup.lat},${pickup.lng}` : '';
      const deliveryStr = delivery ? `${delivery.lat},${delivery.lng}` : '';
      const pickupHash = ethers.keccak256(ethers.toUtf8Bytes(pickupStr));
      const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes(deliveryStr));

      const tx = await contract.createJob(
        formData.recipient,
        riderAddr,
        parseInt(formData.duration),
        '0x0000000000000000000000000000000000000000',
        0,
        pickupHash,
        deliveryHash,
        { value: amount }
      );

      const receipt = await tx.wait();
      const jobCreatedEvent = receipt.logs.find((log) => {
        try { return contract.interface.parseLog(log)?.name === 'JobCreated'; }
        catch { return false; }
      });

      if (jobCreatedEvent) {
        const parsed = contract.interface.parseLog(jobCreatedEvent);
        const jobId = parsed.args.jobId.toString();
        setCreatedJobId(jobId);
        setCreatedPin(parsed.args.pin.toString().padStart(6, '0'));

        try {
          await api.jobs.create({
            job_id: parseInt(jobId),
            pickup_location: pickupStr,
            delivery_location: deliveryStr,
          });
        } catch (apiErr) {
          console.warn('API sync failed (non-critical):', apiErr.message);
        }
      }

      setStatus(`Job created! TX: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`);
      setFormData({ recipient: '', rider: '', duration: '', amount: '' });
      setPickup(null);
      setDelivery(null);
    } catch (err) {
      setStatus(`Error: ${err.reason || err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: '0.8rem', color: '#999', display: 'flex', alignItems: 'center', gap: '0.35rem' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {!address && (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
          <Wallet size={24} style={{ color: '#3b82f6', marginBottom: '0.75rem' }} />
          <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>Connect your wallet to create a delivery job</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectButton />
          </div>
        </div>
      )}

      {address && !user && (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>Sign in with your wallet to continue</p>
          <button onClick={login} disabled={loggingIn} style={{ width: 'auto', padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {loggingIn ? <><Loader2 size={14} className="spin" /> Signing...</> : 'Sign In with Ethereum'}
          </button>
        </div>
      )}

      {address && user && (
        <>
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

          <div style={{ ...labelStyle, marginTop: '0.25rem' }}><MapPin size={13} /> Pickup Location</div>
          <LocationSearch onSelect={handlePickupSelect} placeholder="Search address, shop, landmark..." />

          <div style={labelStyle}><MapPin size={13} /> Delivery Location</div>
          <LocationSearch onSelect={handleDeliverySelect} placeholder="Search address, shop, landmark..." />

          {(markers.length > 0 || route) && (
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
              <MapView center={mapCenter} markers={markers} route={route} height="280px" />
            </div>
          )}

          {route && (
            <div style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#3b82f6' }}>
                <Route size={14} />
                <span>{route.distanceKm.toFixed(1)} km</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b' }}>
                <Truck size={14} />
                <span>{formatDuration(route.durationSec)} drive</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#999' }}>
                <DollarSign size={14} />
                <span>1 MON = ${monUsd.toFixed(2)}</span>
              </div>
            </div>
          )}

          {routeLoading && (
            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Route size={12} /> Calculating route...
            </div>
          )}

          {priceLoading && route && (
            <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <DollarSign size={12} /> Fetching MON price...
            </div>
          )}

          {pricing && (
            <div
              onClick={applySuggestedPrice}
              style={{
                background: '#0a1628',
                border: '1px solid #1e3a5f',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e3a5f')}
            >
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <DollarSign size={12} /> Fair Price — {pricing.tierLabel} (click to apply)
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#999' }}>
                <span>Base fee</span><span>${pricing.baseUsd.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#999' }}>
                <span>Distance ({route.distanceKm.toFixed(1)} km)</span><span>${pricing.distanceFeeUsd.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#999' }}>
                <span>Platform fee ({pricing.platformFeePct}%)</span><span>${pricing.platformFeeUsd.toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px solid #222', marginTop: '0.35rem', paddingTop: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#22c55e' }}>
                  <span>Rider receives</span><span>${pricing.riderReceivesUsd.toFixed(2)} / {usdToMon(pricing.riderReceivesUsd, monUsd).toFixed(4)} MON</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: '#ededed', marginTop: '0.25rem' }}>
                  <span>Total you pay</span><span>${pricing.totalUsd.toFixed(2)} / {pricing.totalMon} MON</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="number"
                placeholder={pricing ? `~${pricing.totalMon} MON` : 'Duration (min)'}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
                style={{ paddingLeft: '2.25rem' }}
              />
              <Clock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="number"
                step="0.0001"
                placeholder={pricing ? `~$${pricing.totalUsd.toFixed(2)}` : 'Amount (MON)'}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                style={{
                  paddingLeft: '2.25rem',
                  borderColor: priceStatus === 'below' ? '#ef4444' : priceStatus === 'good' ? '#22c55e' : priceStatus === 'high' ? '#f59e0b' : undefined,
                }}
              />
              <Coins size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
            </div>
          </div>

          {formData.amount && pricing && (
            <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'right' }}>
              = ${(parseFloat(formData.amount) * monUsd).toFixed(2)} USD
            </div>
          )}

          {priceStatus === 'below' && pricing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#ef4444', background: '#2a0a0a', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <AlertTriangle size={13} />
              Below minimum ${pricing.baseUsd.toFixed(2)} USD ({pricing.minMon} MON). Riders won&apos;t accept below this.
            </div>
          )}

          {priceStatus === 'high' && pricing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#f59e0b', background: '#2a1a06', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
              <AlertTriangle size={13} />
              This is {(parseFloat(formData.amount) * monUsd / pricing.totalUsd).toFixed(1)}x the suggested price. Are you sure?
            </div>
          )}

          {priceStatus === 'low' && pricing && (
            <div style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              Below suggested — riders may take longer to accept.
            </div>
          )}

          <button type="submit" disabled={loading || !address || !user} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Send size={16} />
            {loading ? 'Creating...' : 'Create Delivery Job'}
          </button>
        </>
      )}

      {status && (
        <p style={{ color: status.startsWith('Error') ? '#ef4444' : '#22c55e', fontSize: '0.9rem', wordBreak: 'break-all' }}>
          {status}
        </p>
      )}

      {createdPin && (
        <div style={{ background: '#0a1628', border: '2px solid #22c55e', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ color: '#22c55e', marginBottom: '0.5rem' }}><KeyRound size={20} /></div>
          <p style={{ color: '#999', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>Delivery PIN (share with recipient)</p>
          <p style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', margin: '0', letterSpacing: '0.3em' }}>
            {createdPin}
          </p>
          <p style={{ color: '#666', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Job #{createdJobId}</p>
        </div>
      )}
    </form>
  );
}
