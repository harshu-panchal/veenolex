import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Home, Briefcase, MapPin, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useLocation } from '../context/LocationContext';
import AddressFormModal from '../components/shared/AddressFormModal';

const AddressesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshAddresses } = useLocation();
    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? '');
            setProfilePhone(profile?.phone ?? '');
            setAddresses(raw.map((addr, idx) => ({
                id: addr._id ?? idx,
                type: (addr.label || 'home').charAt(0).toUpperCase() + (addr.label || 'home').slice(1),
                name: profile?.name ?? '',
                address: addr.fullAddress || [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || '',
                rawFullAddress: addr.fullAddress || '',
                landmark: addr.landmark || '',
                city: addr.city || '',
                state: addr.state || '',
                pincode: addr.pincode || '',
                location: addr.location || null,
                placeId: addr.placeId || '',
                phone: profile?.phone ?? '',
                isDefault: idx === 0
            })));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Auto-open Add modal when navigated with ?add=1
    useEffect(() => {
        if (searchParams.get('add') === '1' && !loading) {
            setSearchParams({}, { replace: true });
            setIsAddOpen(true);
        }
    }, [searchParams, loading, setSearchParams]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);

    const handleSaveNewAddress = async (formData) => {
        const name = formData.name?.trim();
        const address = formData.address?.trim();
        const city = formData.city?.trim();
        const landmark = formData.landmark?.trim();
        const state = formData.state?.trim();
        const pincode = formData.pincode?.trim();
        const phone = formData.phone?.trim();

        const newAddr = {
            label: (formData.type || 'home').toLowerCase(),
            fullAddress: address,
            ...(landmark && { landmark }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode }),
            ...(formData.location && { location: formData.location }),
            ...(formData.placeId && { placeId: formData.placeId }),
        };

        // If coordinates weren't already captured, best-effort geocode
        if (!newAddr.location) {
            try {
                const query = [address, landmark, city, state, pincode].filter(Boolean).join(', ');
                const geo = await customerApi.geocodeAddress(query);
                const loc = geo.data?.result?.location;
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                    newAddr.location = { lat: loc.lat, lng: loc.lng };
                    if (geo.data?.result?.placeId) newAddr.placeId = geo.data.result.placeId;
                    if (geo.data?.result?.formattedAddress) newAddr.formattedAddress = geo.data.result.formattedAddress;
                }
            } catch {
                // best effort
            }
        }

        try {
            await customerApi.updateProfile({
                ...(name && { name }),
                ...(phone && { phone }),
                addresses: [...rawAddresses, newAddr]
            });
            toast.success('Address saved successfully');
            setIsAddOpen(false);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save address');
            throw err;
        }
    };

    const handleEdit = (addr) => {
        setSelectedAddress(addr);
        setIsEditOpen(true);
    };

    const handleUpdateAddress = async (formData) => {
        if (!selectedAddress) return;
        const address = formData.address?.trim();
        const city = formData.city?.trim();
        const landmark = formData.landmark?.trim();
        const state = formData.state?.trim();
        const pincode = formData.pincode?.trim();
        const name = formData.name?.trim();
        const phone = formData.phone?.trim();

        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsEditOpen(false);
            return;
        }

        const updatedRaw = {
            ...(rawAddresses[idx] && typeof rawAddresses[idx] === 'object' ? rawAddresses[idx] : {}),
            label: (formData.type || 'home').toLowerCase(),
            fullAddress: address,
            ...(landmark && { landmark }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode }),
            ...(formData.location ? { location: formData.location } : {}),
            ...(formData.placeId ? { placeId: formData.placeId } : {}),
        };

        if (!updatedRaw.location) {
            try {
                const query = [address, landmark, city, state, pincode].filter(Boolean).join(', ');
                const geo = await customerApi.geocodeAddress(query);
                const loc = geo.data?.result?.location;
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                    updatedRaw.location = { lat: loc.lat, lng: loc.lng };
                    if (geo.data?.result?.placeId) updatedRaw.placeId = geo.data.result.placeId;
                    if (geo.data?.result?.formattedAddress) updatedRaw.formattedAddress = geo.data.result.formattedAddress;
                }
            } catch {
                // best effort
            }
        }

        const updatedAddresses = rawAddresses.map((raw, i) => (i === idx ? updatedRaw : raw));
        try {
            await customerApi.updateProfile({
                ...(name && { name }),
                ...(phone && { phone }),
                addresses: updatedAddresses
            });
            toast.success('Address updated successfully');
            setIsEditOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update address');
            throw err;
        }
    };

    const handleDelete = (addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    };

    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsDeleteOpen(false);
            return;
        }
        const updatedAddresses = rawAddresses.filter((_, i) => i !== idx);
        setDeleting(true);
        try {
            await customerApi.updateProfile({ addresses: updatedAddresses });
            toast.success('Address deleted successfully');
            setIsDeleteOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete address');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Saved Addresses</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Add New Address Button */}
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="w-full bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-slate-700 hover:bg-slate-50 hover:border-primary/50 transition-all group shadow-sm"
                >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-sm text-slate-800">Add New Address</span>
                </button>

                {/* Address List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <p className="text-slate-500 font-medium">Loading addresses...</p>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
                            <MapPin size={36} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-700 font-bold mb-1 text-base">No saved addresses</p>
                            <p className="text-slate-500 text-xs">Add your delivery address above to order quickly</p>
                        </div>
                    ) : addresses.map((addr) => (
                        <div key={addr.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden transition-all hover:border-slate-300">
                            {addr.isDefault && (
                                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm">
                                    Default
                                </div>
                            )}

                            <div className="flex items-start gap-3.5">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5">
                                    {addr.type === 'Home' ? <Home size={18} className="text-primary" /> : addr.type === 'Work' ? <Briefcase size={18} className="text-blue-600" /> : <MapPin size={18} className="text-emerald-600" />}
                                </div>
                                <div className="flex-1 pr-14">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-sm font-bold text-slate-800">{addr.type}</h3>
                                    </div>
                                    <p className="text-slate-900 font-semibold text-sm mb-1">{addr.name}</p>
                                    <p className="text-slate-600 text-xs leading-relaxed mb-1">{addr.address}</p>
                                    {(addr.city || addr.state || addr.pincode) && (
                                        <p className="text-slate-400 text-xs mb-2 font-medium">
                                            {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                    {addr.phone && (
                                        <p className="text-slate-700 font-medium text-xs">Phone: {addr.phone}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => handleEdit(addr)}
                                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(addr)}
                                    className="flex-1 py-2 rounded-xl bg-slate-100 text-red-600 font-bold text-xs hover:bg-red-50 hover:text-red-700 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Address Modal with Google Places Autocomplete */}
            <AddressFormModal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title="Add New Address"
                description="Type your address or city to auto-fill state and pincode."
                onSave={handleSaveNewAddress}
                defaultName={profileName}
                defaultPhone={profilePhone}
            />

            {/* Edit Address Modal with Google Places Autocomplete */}
            {selectedAddress && (
                <AddressFormModal
                    isOpen={isEditOpen}
                    onClose={() => {
                        setIsEditOpen(false);
                        setSelectedAddress(null);
                    }}
                    initialData={{
                        type: selectedAddress.type,
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        address: selectedAddress.rawFullAddress || selectedAddress.address,
                        landmark: selectedAddress.landmark,
                        city: selectedAddress.city,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                        location: selectedAddress.location,
                        placeId: selectedAddress.placeId,
                    }}
                    title="Edit Address"
                    description="Update your delivery details with Google Maps suggestions."
                    onSave={handleUpdateAddress}
                    defaultName={profileName}
                    defaultPhone={profilePhone}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 font-bold">Delete Address?</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Are you sure you want to delete this address? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800 text-xs">{selectedAddress.type}</span>
                            </div>
                            <p className="text-slate-600 text-xs leading-relaxed">{selectedAddress.address}</p>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting} className="rounded-xl text-xs">Cancel</Button>
                        <Button variant="destructive" className="bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold" onClick={handleConfirmDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddressesPage;
