const fs = require('fs');
const path = require('path');

const filePath = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/modules/admin/pages/AdminProfile.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  "import { adminApi } from '../services/adminApi';",
  "import { adminApi } from '../services/adminApi';\nimport LocationSettingsCard from '../../../shared/components/LocationSettingsCard';\nimport MapPicker from '../../../shared/components/MapPicker';"
);
content = content.replace(
    "import {\n    Save,",
    "import { MapPin } from 'lucide-react';\nimport {\n    Save,"
);

// 2. States
content = content.replace(
    "const [activeTab, setActiveTab] = useState('profile');",
    "const [activeTab, setActiveTab] = useState('profile');\n    const [isLocationEditing, setIsLocationEditing] = useState(false);\n    const [isMapOpen, setIsMapOpen] = useState(false);"
);

content = content.replace(
    "role: 'Admin'\n    });",
    "role: 'Admin',\n        lat: null,\n        lng: null,\n        radius: 5,\n        address: ''\n    });"
);

// 3. fetchProfile mapping
content = content.replace(
    "role: data.role || 'Admin'\n            });",
    "role: data.role || 'Admin',\n                lat: data.location?.coordinates?.[1] || null,\n                lng: data.location?.coordinates?.[0] || null,\n                radius: data.serviceRadius || 5,\n                address: data.address || ''\n            });"
);

// 4. handleProfileUpdate payload
content = content.replace(
    "email: profile.email\n            });",
    "email: profile.email,\n                lat: profile.lat,\n                lng: profile.lng,\n                radius: profile.radius,\n                address: profile.address\n            });"
);

// 5. handleLocationSelect method
content = content.replace(
    "const handlePasswordUpdate = async (e) => {",
    "const handleLocationSelect = (location) => {\n        setProfile(prev => ({\n            ...prev,\n            lat: location.lat,\n            lng: location.lng,\n            radius: location.radius,\n            address: location.address\n        }));\n    };\n\n    const handlePasswordUpdate = async (e) => {"
);

// 6. Sidebar tab
content = content.replace(
    "</button>\n                        </div>",
    "</button>\n                            <button\n                                onClick={() => setActiveTab('location')}\n                                className={cn(\n                                    \"w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all mt-1\",\n                                    activeTab === 'location'\n                                        ? \"bg-white text-brand-600 shadow-sm ring-1 ring-slate-100\"\n                                        : \"text-slate-400 hover:text-slate-600 hover:bg-slate-100/50\"\n                                )}\n                            >\n                                <MapPin className=\"h-4 w-4\" />\n                                Warehouse Location\n                            </button>\n                        </div>"
);

// 7. Content area and MapPicker
const locationTabContent = `
                    {/* Location Tab */}
                    {activeTab === 'location' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <LocationSettingsCard
                                formData={profile}
                                isEditing={isLocationEditing}
                                setIsEditing={setIsLocationEditing}
                                setIsMapOpen={setIsMapOpen}
                                entityType="admin"
                            />
                            {isLocationEditing && (
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleProfileUpdate}
                                        disabled={isSaving}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-4 bg-black text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-100 active:scale-95",
                                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-brand-700"
                                        )}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Location'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
`;

content = content.replace(
    "</div>\n            </div>\n        </div>",
    `</div>\n            </div>\n${locationTabContent}\n            {isMapOpen && (\n                <MapPicker\n                    isOpen={isMapOpen}\n                    onClose={() => setIsMapOpen(false)}\n                    onConfirm={handleLocationSelect}\n                    initialLocation={profile.lat ? { lat: profile.lat, lng: profile.lng } : null}\n                    initialRadius={profile.radius}\n                />\n            )}\n        </div>`
);

fs.writeFileSync(filePath, content);
console.log("AdminProfile.jsx patched.");
