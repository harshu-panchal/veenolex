import React from 'react';
import { ChevronLeft, Truck, Heart, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import sandeepRathore from '@/assets/sandeep-rathore.png';
import rajeshPatel from '@/assets/rajesh-patel.jpg';

const AboutPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">About Us</h1>
            </div>

            <div className="px-4 pt-6 max-w-6xl mx-auto space-y-12">

                {/* Founders Section */}
                <div className="bg-slate-50">
                    <div className="grid lg:grid-cols-2 gap-10 items-start">
                        {/* Text Content */}
                        <div className="space-y-6 lg:pr-8">
                            <h2 className="text-4xl md:text-5xl font-light text-slate-800 leading-tight">
                                Meet Founders of <br className="hidden md:block" />Veenolex
                            </h2>
                            <p className="text-slate-600 leading-relaxed text-base md:text-lg">
                                Veenolex Herabal not only a Ayurvdic Herbal company but it's a dream of two pationate founders from Pratapgarh and Sagwara Rajasthan, found a adultration in cosmetic industry and to fill the gape into market to relay on trust of customers a deep research of 3 years has concluded us into this company which is consumer centric with pure essential of Natural Herbals
                            </p>
                        </div>
                        
                        {/* Founder Cards */}
                        <div className="grid sm:grid-cols-2 gap-6">
                            {/* Card 1 */}
                            <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 flex flex-col group cursor-pointer hover:border-pink-300">
                                <div className="h-64 sm:h-72 overflow-hidden">
                                    <img src={rajeshPatel} alt="Mr. Rajesh Patel" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                                </div>
                                <div className="p-6 flex flex-col flex-grow text-center">
                                    <h3 className="text-2xl font-bold font-serif text-slate-800 mb-1" style={{fontFamily: "'Playfair Display', serif"}}>Mr. Rajesh Patel</h3>
                                    <p className="text-xs text-slate-400 mb-4 uppercase tracking-widest font-semibold">CEO</p>
                                    <p className="text-sm text-slate-500 leading-relaxed">Future is in your hand, think about it and take action and move on</p>
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 flex flex-col group cursor-pointer hover:border-pink-300">
                                <div className="h-64 sm:h-72 overflow-hidden">
                                    <img src={sandeepRathore} alt="Mr. Sandeep Rathore" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                                </div>
                                <div className="p-6 flex flex-col flex-grow text-center">
                                    <h3 className="text-2xl font-bold font-serif text-slate-800 mb-1" style={{fontFamily: "'Playfair Display', serif"}}>Mr. Sandeep Rathore</h3>
                                    <p className="text-xs text-slate-400 mb-4 uppercase tracking-widest font-semibold">Co - Founder</p>
                                    <p className="text-sm text-slate-500 leading-relaxed">After a Succesful journey in Yash Courier and Cargo Agency, dive in Veenolex Herbal as Co - Founder @ Veenolex.com</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                    {/* Hero Section / About App */}
                    <div className="rounded-xl p-6 text-center bg-white border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center">
                            <div className="bg-slate-50 p-4 rounded-full mb-4">
                                <ShoppingBag size={28} className="text-slate-700" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2 tracking-tight text-slate-900">{appName}</h2>
                            <p className="text-slate-600 text-sm max-w-sm mx-auto">Delivering happiness to your doorstep in minutes.</p>
                        </div>
                    </div>

                    {/* Mission Card */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 mb-3">
                                <Truck size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Our Mission</h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm text-center">
                            To revolutionize quick commerce by providing the fastest, most reliable delivery of daily essentials, ensuring quality and convenience for every household.
                        </p>
                    </div>

                    {/* Values Card */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 mb-3">
                                <Heart size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Our Values</h3>
                        </div>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex gap-3 items-start">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                                <span><strong>Customer First:</strong> Your satisfaction is our top priority.</span>
                            </li>
                            <li className="flex gap-3 items-start">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                                <span><strong>Quality Assurance:</strong> We deliver only the freshest and best products.</span>
                            </li>
                            <li className="flex gap-3 items-start">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                                <span><strong>Speed with Safety:</strong> Fast delivery without compromising safety.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="text-center pt-8 pb-4">
                    <p className="text-xs text-slate-400 font-medium tracking-wide">© {new Date().getFullYear()} {appName}. All rights reserved.</p>
                </div>

            </div>
        </div>
    );
};

export default AboutPage;
