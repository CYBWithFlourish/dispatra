import { useState, useEffect } from 'react';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

export default function useRoute(pickup, delivery) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickup || !delivery) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const url = `${OSRM_URL}/${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}?overview=full&geometries=geojson&steps=false`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
          setRoute(null);
          return;
        }

        const r = data.routes[0];
        const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        setRoute({
          coords,
          distanceKm: r.distance / 1000,
          durationSec: r.duration,
          durationMin: Math.ceil(r.duration / 60),
        });
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, delivery?.lat, delivery?.lng]);

  return { route, loading };
}
