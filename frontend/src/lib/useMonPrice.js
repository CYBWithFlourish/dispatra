import { useState, useEffect } from 'react';
import { FALLBACK_MON_USD } from './mapConfig.js';

export default function useMonPrice() {
  const [monUsd, setMonUsd] = useState(FALLBACK_MON_USD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd'
        );
        const data = await res.json();
        if (!cancelled && data?.monad?.usd) {
          setMonUsd(data.monad.usd);
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { monUsd, loading };
}
