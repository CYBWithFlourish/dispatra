import { isLeaflet, isGoogleMaps } from '../lib/mapConfig.js';
import LeafletMap from './LeafletMap.jsx';
import GoogleMapsMap from './GoogleMapsMap.jsx';

export default function MapView(props) {
  if (isGoogleMaps()) {
    return <GoogleMapsMap {...props} />;
  }

  if (isLeaflet()) {
    return <LeafletMap {...props} />;
  }

  return (
    <div
      style={{
        width: '100%',
        height: props.height || '400px',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
      }}
    >
      Configure PUBLIC_MAP_PROVIDER in .env (leaflet or google)
    </div>
  );
}
