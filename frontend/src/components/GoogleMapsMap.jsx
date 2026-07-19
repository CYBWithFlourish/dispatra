import { useEffect, useRef, useState } from 'react';
import { MONAD_CENTER, DEFAULT_ZOOM, GOOGLE_MAPS_API_KEY } from '../lib/mapConfig.js';

export default function GoogleMapsMap({
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      disableDefaultUI: false,
      zoomControl: true,
    });

    mapInstance.current = map;
    updateMarkers(map, markers);
    updateRoute(map, route);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [loaded]);

  useEffect(() => {
    if (!mapInstance.current) return;
    updateMarkers(mapInstance.current, markers);
  }, [markers]);

  useEffect(() => {
    if (!mapInstance.current) return;
    updateRoute(mapInstance.current, route);
  }, [route]);

  function updateMarkers(map, markerData) {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markerData.forEach((m) => {
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: m.label || '',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: m.color || '#3b82f6',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
          scale: 8,
        },
      });

      if (m.popup) {
        const infoWindow = new window.google.maps.InfoWindow({ content: m.popup });
        marker.addListener('click', () => infoWindow.open(map, marker));
      }

      if (onMarkerClick) {
        marker.addListener('click', () => onMarkerClick(m));
      }

      markersRef.current.push(marker);
    });
  }

  function updateRoute(map, routeData) {
    if (routeRef.current) {
      routeRef.current.setMap(null);
      routeRef.current = null;
    }

    if (!routeData || !routeData.coords || routeData.coords.length < 2) return;

    const path = routeData.coords.map(([lat, lng]) => ({ lat, lng }));

    const polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1 }, offset: '0', repeat: '10px' }],
    });

    polyline.setMap(map);
    routeRef.current = polyline;

    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 40);
  }

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height, borderRadius: '8px', overflow: 'hidden' }}
      className={className}
    />
  );
}
