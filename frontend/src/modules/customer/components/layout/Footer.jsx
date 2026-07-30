import React from 'react';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/assets/Logo.png';
import { useSettings } from '@core/context/SettingsContext';
import { Link } from 'react-router-dom';
import { customerApi } from '../../services/customerApi';

const Footer = () => {
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || Logo;
    const primaryColor = settings?.primaryColor || 'var(--primary)';

    const [categories, setCategories] = React.useState([]);

    React.useEffect(() => {
        let isMounted = true;
        customerApi.getCategories()
            .then((res) => {
                if (isMounted && res?.data?.success) {
                    const dbCats = res.data.results || res.data.result || [];
                    const mainCategories = dbCats.filter((cat) => cat.type === 'category');
                    setCategories(mainCategories.slice(0, 5));
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

    return (
        <footer className="relative bg-[#f2f2f2] pt-20 pb-10 mt-20 text-slate-800 md:bg-gradient-to-br md:from-[#fbfbfb] md:via-[#f2f2f2] md:to-[#e6e6e6] md:pt-32 md:pb-16 md:mt-32 overflow-hidden">
            {/* Subtle Texture/Glow Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px]" style={{ backgroundColor: primaryColor }} />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px]" style={{ backgroundColor: primaryColor }} />
            </div>

            {/* Top Curved Divider */}
            <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg className="relative block w-[calc(100%+1.3px)] h-[25px] md:h-[60px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white"></path>
                </svg>
            </div>

            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <img src={logoUrl} alt={`${settings?.appName || 'App'} Logo`} loading="lazy" className="h-12 md:h-16 w-auto object-contain" />
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-gray-800 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-200/60 text-gray-800 rounded-full transition-all hover:bg-slate-300 hover:text-black group active:scale-95"><Facebook size={18} /></a>}
                            {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-200/60 text-gray-800 rounded-full transition-all hover:bg-slate-300 hover:text-black group active:scale-95"><Twitter size={18} /></a>}
                            {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-200/60 text-gray-800 rounded-full transition-all hover:bg-slate-300 hover:text-black group active:scale-95"><Instagram size={18} /></a>}
                            {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-200/60 text-gray-800 rounded-full transition-all hover:bg-slate-300 hover:text-black group active:scale-95"><Youtube size={18} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-4">
                        <h3 className="text-slate-900 font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            <li><Link to="/" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Home</Link></li>
                            <li><Link to="/about" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>About Us</Link></li>
                            <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Shop</Link></li>
                            <li><Link to="/" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Blogs</Link></li>
                            <li><Link to="/support" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Contact</Link></li>
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-slate-900 font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {categories.length > 0 ? (
                                categories.map((cat) => (
                                    <li key={cat._id}>
                                        <Link to={`/category/${cat._id}`} className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800">
                                            <span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>
                                            {cat.name}
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                <>
                                    <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Fruits & Vegetables</Link></li>
                                    <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Dairy Products</Link></li>
                                    <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Meat & Fish</Link></li>
                                    <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Bakery & Snacks</Link></li>
                                    <li><Link to="/categories" className="hover:text-[#0f9ed5] transition-colors md:text-base md:font-semibold flex items-center group text-slate-800"><span className="hidden md:block w-0 h-px bg-[#0f9ed5] group-hover:w-4 group-hover:mr-2 transition-all"></span>Beverages</Link></li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-slate-900 font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-slate-200/60 items-center justify-center text-slate-800 transition-all shrink-0"><MapPin size={22} /></div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-slate-800 md:pt-1 font-medium">{settings?.address || 'RIICO Industrial Area, Sagwara, Dungarpur, Rajasthan - 314025'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-slate-200/60 items-center justify-center text-slate-800 transition-all shrink-0"><Phone size={22} /></div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-slate-800 font-medium">{settings?.supportPhone || '9351478056 - 9799911623'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-slate-200/60 items-center justify-center text-slate-800 transition-all shrink-0"><Mail size={22} /></div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-slate-800 font-medium">{settings?.supportEmail || 'veenolexharbal@gmail.com'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-black/10 mt-12 pt-8 text-center text-sm md:flex md:justify-between md:text-left md:mt-24 md:pt-12">
                    <p className="md:text-base text-slate-600">&copy; {new Date().getFullYear()} {settings?.appName || 'App'}. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <Link to="/privacy" className="hover:text-[#0f9ed5] md:text-base text-slate-600 transition-all">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-[#0f9ed5] md:text-base text-slate-600 transition-all">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


