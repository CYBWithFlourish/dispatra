import { useEffect, useRef } from 'react';
import { MONAD_CENTER, DEFAULT_ZOOM, PIN_COLORS } from '../lib/mapConfig.js';

export default function LeafletMap({
  center = MONAD_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  route = null,
  onMarkerClick,
  height = '400px',
  className = '',
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
      updateMarkers(L, map, markers);
      updateRoute(L, map, route);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    import('leaflet').then((L) => {
      updateMarkers(L, mapInstance.current, markers);
    });
  }, [markers]);

  useEffect(() => {
    if (!mapInstance.current) return;
    import('leaflet').then((L) => {
      updateRoute(L, mapInstance.current, route);
    });
  }, [route]);

  function updateMarkers(L, map, markerData) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markerData.forEach((m) => {
      const color = m.color || PIN_COLORS.job;
      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:${color};transform:rotate(-45deg);
          border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        "><span style="transform:rotate(45deg);font-size:11px;color:white;font-weight:700;">${m.label || ''}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.popup) marker.bindPopup(m.popup);
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m));
      markersRef.current.push(marker);
    });
  }

  function updateRoute(L, map, routeData) {
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (!routeData || !routeData.coords || routeData.coords.length < 2) return;

    const polyline = L.polyline(routeData.coords, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      dashArray: '8, 6',
    }).addTo(map);

    routeRef.current = polyline;

    if (routeData.coords.length > 0) {
      const bounds = L.latLngBounds(routeData.coords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height, borderRadius: '8px', overflow: 'hidden' }}
      className={className}
    />
  );
}
