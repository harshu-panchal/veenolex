import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { MapPin, Search, Navigation, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation } from './../modules/customer/context/LocationContext';

// Fix Leaflet's default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ position, setPosition }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const markerRef = useRef(null);
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker
      draggable={true}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            setPosition(marker.getLatLng());
          }
        },
      }}
      position={position}
      ref={markerRef}
    />
  );
};

const ChangeLocationModal = ({ isOpen, onClose, onConfirm, isLoading }) => {
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'gps', 'map'
  
  // Option 1: GPS
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  
  // Option 2: Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Option 3: Map
  const [mapPosition, setMapPosition] = useState({ lat: 20.5937, lng: 78.9629 }); // Default India

  // Selected State
  const [selectedLocation, setSelectedLocation] = useState(null);
  const { currentLocation } = useLocation();

  // On Open: Hydrate default selected location
  useEffect(() => {
    if (isOpen) {
      if (currentLocation?.latitude && currentLocation?.longitude) {
        setSelectedLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: currentLocation.name || currentLocation.address || '',
          city: currentLocation.city || '',
          pincode: currentLocation.pincode || ''
        });
      }
    }
  }, [isOpen, currentLocation]);

  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      setMapPosition({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
    }
  }, [selectedLocation]);

  // Cleanup map container resize bug on tab switch
  useEffect(() => {
    if (activeTab === 'map') {
      window.dispatchEvent(new Event('resize'));
    }
  }, [activeTab]);

  // --- Option 1: GPS Fetch ---
  const handleUseGps = () => {
    setIsGpsLoading(true);
    setActiveTab('gps');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          if (!response.ok) throw new Error("Network response was not ok");
          const data = await response.json();
          setSelectedLocation({
            latitude,
            longitude,
            address: data.display_name,
            city: data.address?.city || data.address?.town || data.address?.village || '',
            pincode: data.address?.postcode || ''
          });
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

  // --- Option 2: Search ---
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
        const data = await response.json();
        setSearchResults(data);
      } catch (err) {
        console.error("Search API Error", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  const handleSelectSearchResult = (result) => {
    setSelectedLocation({
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
      city: result.address?.city || result.address?.town || result.address?.village || '', 
      pincode: result.address?.postcode || ''
    });
    setSearchResults([]);
    setSearchQuery(result.display_name);
    setActiveTab('search');
  };

  // --- Option 3: Map Drag ---
  useEffect(() => {
    if (activeTab === 'map' && mapPosition) {
      const fetchMapAddress = async () => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${mapPosition.lat}&lon=${mapPosition.lng}&format=json`);
          const data = await response.json();
          setSelectedLocation({
            latitude: mapPosition.lat,
            longitude: mapPosition.lng,
            address: data.display_name,
            city: data.address?.city || data.address?.town || data.address?.village || '',
            pincode: data.address?.postcode || ''
          });
        } catch (error) {
          console.error("Map Reverse Geocode Error", error);
        }
      };
      
      const debounce = setTimeout(() => {
        fetchMapAddress();
      }, 500);
      
      return () => clearTimeout(debounce);
    }
  }, [mapPosition, activeTab]);

  const handleConfirm = () => {
    if (selectedLocation && onConfirm) {
      onConfirm(selectedLocation);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 overflow-hidden bg-white flex flex-col 
        !top-auto !bottom-0 !left-0 !right-0 !translate-y-0 !translate-x-0 w-full rounded-t-2xl rounded-b-none max-h-[90vh] data-[state=open]:!slide-in-from-bottom data-[state=closed]:!slide-out-to-bottom
        sm:!top-[50%] sm:!left-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-2xl sm:max-w-[500px] sm:w-[calc(100%-2rem)] md:max-h-[85vh]">
        <style>{`.leaflet-container { z-index: 10 !important; }`}</style>
        
        <DialogHeader className="px-6 py-4 border-b border-slate-100 shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold text-slate-800">Change Your Location</DialogTitle>
          <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {/* Option 1: GPS */}
          <button 
            onClick={handleUseGps}
            disabled={isGpsLoading}
            className="w-full flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <Navigation size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-primary">{isGpsLoading ? 'Detecting location...' : 'Use My Current Location'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Allow GPS access for precise location</p>
              </div>
            </div>
            {isGpsLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : <MapPin size={18} className="text-primary/50" />}
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Option 2: Search */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                placeholder="Search your area or city..."
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
            {activeTab === 'search' && (
              <div className="bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden max-h-[220px] overflow-y-auto z-50 relative">
                {isSearching && searchResults.length === 0 && (
                  <div className="p-4 flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </span>
                    Searching...
                  </div>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700 line-clamp-2 leading-snug">{result.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Option 3: Map */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pick on Map</label>
              <button 
                onClick={() => setActiveTab('map')}
                className={`text-xs font-bold ${activeTab === 'map' ? 'text-primary' : 'text-slate-400'}`}
              >
                {activeTab === 'map' ? 'Map Active' : 'Activate Map'}
              </button>
            </div>
            
            <div className={`h-[250px] w-full rounded-xl overflow-hidden border transition-all ${activeTab === 'map' ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-slate-200 shadow-sm opacity-80'} relative`}>
              {/* Overlay to intercept clicks when map is not active */}
              {activeTab !== 'map' && (
                <div 
                  className="absolute inset-0 bg-transparent z-50 cursor-pointer" 
                  onClick={() => setActiveTab('map')}
                />
              )}
              
              <MapContainer 
                center={[mapPosition.lat, mapPosition.lng]} 
                zoom={13} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker 
                  position={mapPosition} 
                  setPosition={setMapPosition} 
                />
              </MapContainer>
            </div>
          </div>

        </div>

        {/* Selected Location Confirmation Footer */}
        {selectedLocation && (
          <div className="shrink-0 border-t border-slate-200 bg-white p-5 flex flex-col gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-20">
            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="mt-0.5 shrink-0 bg-primary/10 p-1.5 rounded-full text-primary">
                <MapPin size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Selected Location</p>
                <p className="text-sm text-slate-800 font-semibold leading-snug line-clamp-2">
                  {selectedLocation.address}
                </p>
              </div>
            </div>
            <button 
              onClick={handleConfirm}
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-[#0b721b] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 
              {isLoading ? 'Saving...' : 'Confirm Location'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChangeLocationModal;
