import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Search, Navigation, Loader2, Check, X, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { loadGoogleMaps } from '@/core/services/googleMapsLoader';
import { useLocation } from './../modules/customer/context/LocationContext';

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' };

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  clickableIcons: false,
};

const SEARCH_DEBOUNCE_MS = 500;
const MAX_SUGGESTIONS = 5;
const COORD_EPSILON = 0.000001;

// Pull a named address component (e.g. "locality") out of a Geocoder result.
const getComponent = (components, types) =>
  components?.find((c) => types.every((t) => c.types.includes(t)))?.long_name;

const buildLocationFromGeocode = (result, lat, lng) => {
  const components = result?.address_components || [];
  return {
    latitude: lat,
    longitude: lng,
    address: result?.formatted_address || '',
    city:
      getComponent(components, ['locality']) ||
      getComponent(components, ['sublocality_level_1']) ||
      getComponent(components, ['postal_town']) ||
      getComponent(components, ['administrative_area_level_2']) ||
      '',
    state: getComponent(components, ['administrative_area_level_1']) || '',
    pincode: getComponent(components, ['postal_code']) || '',
  };
};

const ChangeLocationModal = ({ isOpen, onClose, onConfirm, isLoading }) => {
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'gps', 'map'

  // Google Maps readiness
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const geocoderRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const mapRef = useRef(null);

  // Option 1: GPS
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Option 2: Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const latestSearchIdRef = useRef(0);

  // Option 3: Map
  const [mapPosition, setMapPosition] = useState({ lat: 20.5937, lng: 78.9629 }); // Default India
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 });

  // Selected State
  const [selectedLocation, setSelectedLocation] = useState(null);
  const { currentLocation } = useLocation();

  // --- Google Maps bootstrap (singleton loader, shared with LocationDrawer) ---
  useEffect(() => {
    if (!isOpen || mapsReady) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapsError('Google Maps API key is missing');
      return;
    }

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        geocoderRef.current = new window.google.maps.Geocoder();
        if (window.google?.maps?.places?.AutocompleteService) {
          autocompleteServiceRef.current =
            new window.google.maps.places.AutocompleteService();
        }
        setMapsError('');
        setMapsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setMapsError(err?.message || 'Unable to load Google Maps');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, mapsReady]);

  // A fresh session token per search session keeps Places autocomplete billing low.
  const getSessionToken = useCallback(() => {
    if (
      !sessionTokenRef.current &&
      window.google?.maps?.places?.AutocompleteSessionToken
    ) {
      sessionTokenRef.current =
        new window.google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const reverseGeocode = useCallback((lat, lng) => {
    return new Promise((resolve, reject) => {
      if (!geocoderRef.current) {
        reject(new Error('Geocoder not ready'));
        return;
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && Array.isArray(results) && results[0]) {
          resolve(buildLocationFromGeocode(results[0], lat, lng));
        } else {
          reject(new Error(`Geocoder failed: ${status}`));
        }
      });
    });
  }, []);

  // On Open: Hydrate default selected location
  useEffect(() => {
    if (isOpen) {
      if (currentLocation?.latitude && currentLocation?.longitude) {
        setSelectedLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: currentLocation.name || currentLocation.address || '',
          city: currentLocation.city || '',
          state: currentLocation.state || '',
          pincode: currentLocation.pincode || ''
        });
      }
    }
  }, [isOpen, currentLocation]);

  // Reset the transient search state whenever the modal closes.
  useEffect(() => {
    if (isOpen) return;
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    sessionTokenRef.current = null;
  }, [isOpen]);

  // Keep the map in sync when a location is chosen via GPS or search.
  // Skipped when the coords already match the marker (i.e. the change came from
  // the map itself), so dragging the pin never yanks the viewport back.
  useEffect(() => {
    if (!selectedLocation?.latitude || !selectedLocation?.longitude) return;
    const { latitude, longitude } = selectedLocation;
    if (
      Math.abs(latitude - mapPosition.lat) < COORD_EPSILON &&
      Math.abs(longitude - mapPosition.lng) < COORD_EPSILON
    ) {
      return;
    }
    const next = { lat: latitude, lng: longitude };
    setMapPosition(next);
    setMapCenter(next);
    mapRef.current?.panTo(next);
  }, [selectedLocation, mapPosition.lat, mapPosition.lng]);

  // --- Option 1: GPS Fetch ---
  const handleUseGps = () => {
    setIsGpsLoading(true);
    setActiveTab('gps');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const location = await reverseGeocode(latitude, longitude);
          setSelectedLocation(location);
        } catch (error) {
          console.error("GPS Reverse Geocode Error", error);
          toast.error("Unable to fetch address. Please check your connection.");
        } finally {
          setIsGpsLoading(false);
        }
      },
      (err) => {
        console.error("GPS Error", err);
        setIsGpsLoading(false);
        toast.error("Location permission denied. Please search your area manually or pick on map.");
      }
    );
  };

  // --- Option 2: Search (Google Places Autocomplete) ---
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    if (!mapsReady || !autocompleteServiceRef.current) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      const requestId = latestSearchIdRef.current + 1;
      latestSearchIdRef.current = requestId;

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'in' },
          sessionToken: getSessionToken(),
        },
        (predictions, status) => {
          // Ignore stale responses from older keystrokes.
          if (requestId !== latestSearchIdRef.current) return;

          setIsSearching(false);
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            Array.isArray(predictions)
          ) {
            setSearchResults(predictions.slice(0, MAX_SUGGESTIONS));
            return;
          }
          setSearchResults([]);
        }
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, mapsReady, getSessionToken]);

  const handleSelectSearchResult = (prediction) => {
    if (!geocoderRef.current) return;

    setSearchResults([]);
    setSearchQuery(prediction.description);
    setActiveTab('search');

    geocoderRef.current.geocode(
      { placeId: prediction.place_id },
      (results, status) => {
        // The session ends once a prediction is resolved.
        sessionTokenRef.current = null;

        if (status !== 'OK' || !Array.isArray(results) || !results[0]) {
          toast.error("Could not resolve selected location");
          return;
        }
        const geometry = results[0].geometry?.location;
        if (!geometry) {
          toast.error("Location coordinates not available");
          return;
        }
        const location = buildLocationFromGeocode(
          results[0],
          geometry.lat(),
          geometry.lng()
        );
        setSelectedLocation({
          ...location,
          address: location.address || prediction.description,
        });
      }
    );
  };

  // --- Option 3: Map click / marker drag ---
  const handleMapPick = useCallback(
    async (lat, lng) => {
      setMapPosition({ lat, lng });
      try {
        const location = await reverseGeocode(lat, lng);
        setSelectedLocation(location);
      } catch (error) {
        console.error("Map Reverse Geocode Error", error);
        // Keep the picked coordinates even if the address lookup fails.
        setSelectedLocation((prev) => ({
          ...(prev || {}),
          latitude: lat,
          longitude: lng,
        }));
      }
    },
    [reverseGeocode]
  );

  const handleMapClick = useCallback(
    (e) => {
      if (activeTab !== 'map' || !e.latLng) return;
      handleMapPick(e.latLng.lat(), e.latLng.lng());
    },
    [activeTab, handleMapPick]
  );

  const handleMarkerDragEnd = useCallback(
    (e) => {
      if (!e.latLng) return;
      handleMapPick(e.latLng.lat(), e.latLng.lng());
    },
    [handleMapPick]
  );

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleConfirm = () => {
    if (selectedLocation && onConfirm) {
      if (!selectedLocation.address || !selectedLocation.address.trim()) {
        toast.error("Please enter a valid address");
        return;
      }
      onConfirm(selectedLocation);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 overflow-hidden bg-white flex flex-col
        !top-auto !bottom-0 !left-0 !right-0 !translate-y-0 !translate-x-0 w-full rounded-t-2xl rounded-b-none max-h-[90vh] data-[state=open]:!slide-in-from-bottom data-[state=closed]:!slide-out-to-bottom
        sm:!top-[50%] sm:!left-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-2xl sm:max-w-[520px] sm:w-[calc(100%-2rem)] md:max-h-[85vh]">

        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold text-slate-800">Change Your Location</DialogTitle>
          <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">

          {/* Option 1: GPS */}
          <button
            onClick={handleUseGps}
            disabled={isGpsLoading}
            className="w-full flex items-center justify-between p-3.5 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <Navigation size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-primary text-sm">{isGpsLoading ? 'Detecting location...' : 'Use My Current Location'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Allow GPS access for precise location</p>
              </div>
            </div>
            {isGpsLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : <MapPin size={18} className="text-primary/50" />}
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OR SEARCH / PICK</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Option 2: Search */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Area or Landmark</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                placeholder="Search area, colony, or city..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveTab('search');
                }}
                onFocus={() => setActiveTab('search')}
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {activeTab === 'search' && searchResults.length > 0 && (
              <div className="bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden max-h-[200px] overflow-y-auto z-50 relative">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-700 line-clamp-2 leading-snug">{result.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Option 3: Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pick on Map</label>
              <button
                onClick={() => setActiveTab('map')}
                className={`text-xs font-bold ${activeTab === 'map' ? 'text-primary' : 'text-slate-400'}`}
              >
                {activeTab === 'map' ? 'Map Active' : 'Activate Map'}
              </button>
            </div>

            <div className={`h-[180px] w-full rounded-xl overflow-hidden border transition-all ${activeTab === 'map' ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-slate-200 shadow-sm opacity-80'} relative`}>
              {activeTab !== 'map' && (
                <div
                  className="absolute inset-0 bg-transparent z-50 cursor-pointer"
                  onClick={() => setActiveTab('map')}
                />
              )}

              {mapsReady ? (
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={mapCenter}
                  zoom={13}
                  options={MAP_OPTIONS}
                  onLoad={onMapLoad}
                  onUnmount={onMapUnmount}
                  onClick={handleMapClick}
                >
                  <MarkerF
                    position={mapPosition}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                  />
                </GoogleMap>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-slate-100 text-center px-4">
                  {mapsError ? (
                    <p className="text-xs text-slate-500">{mapsError}</p>
                  ) : (
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Option 4: Direct Manual Address Edit Form */}
          {selectedLocation && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 size={14} className="text-primary" /> Edit Address Manually
                </label>
                <span className="text-[10px] text-slate-400">Click below to edit text</span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Address / Street</label>
                  <textarea
                    rows={2}
                    value={selectedLocation.address || ''}
                    onChange={(e) => setSelectedLocation(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all resize-none"
                    placeholder="Enter house no, street, colony..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">City</label>
                    <input
                      type="text"
                      value={selectedLocation.city || ''}
                      onChange={(e) => setSelectedLocation(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pincode</label>
                    <input
                      type="text"
                      value={selectedLocation.pincode || ''}
                      onChange={(e) => setSelectedLocation(prev => ({ ...prev, pincode: e.target.value }))}
                      className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                      placeholder="Pincode"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Selected Location Confirmation Footer */}
        {selectedLocation && (
          <div className="shrink-0 border-t border-slate-200 bg-white p-4 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-20">
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-[#0b721b] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isLoading ? 'Saving...' : 'Confirm & Save Location'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChangeLocationModal;
