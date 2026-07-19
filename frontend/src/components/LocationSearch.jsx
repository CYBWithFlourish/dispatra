import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

const PHOTON_URL = 'https://photon.komoot.io/api/';

export default function LocationSearch({ onSelect, placeholder = 'Search address...' }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);
  const latestQueryRef = useRef('');

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (q) => {
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6&lang=en`
      );
      const data = await res.json();

      if (latestQueryRef.current !== q) return;

      const results = (data.features || [])
        .filter((f) => f.geometry && f.geometry.coordinates)
        .map((f) => {
          const props = f.properties;
          const parts = [
            props.name,
            props.housenumber,
            props.street,
            props.city || props.town || props.village,
            props.state,
            props.country,
          ].filter(Boolean);
          return {
            label: parts.join(', '),
            short: parts.slice(0, 3).join(', '),
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            type: props.osm_key || 'place',
          };
        });

      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    latestQueryRef.current = val;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (s, e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery(s.short || s.label);
    setOpen(false);
    setSuggestions([]);
    onSelect({ lat: s.lat, lng: s.lng, label: s.label });
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          style={{ paddingLeft: '2.25rem', paddingRight: searching ? '2.25rem' : undefined }}
        />
        {searching && (
          <Loader2 size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666', animation: 'spin 1s linear infinite' }} />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1a1a1a',
            border: '1px solid #333',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            zIndex: 50,
            maxHeight: '240px',
            overflow: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={(e) => handleSelect(s, e)}
              style={{
                padding: '0.55rem 0.75rem',
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid #222' : 'none',
                fontSize: '0.85rem',
                color: '#ccc',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <MapPin size={13} style={{ marginTop: '3px', flexShrink: 0, color: '#666' }} />
              <div>
                <div>{s.short}</div>
                {s.label !== s.short && (
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{s.label}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
