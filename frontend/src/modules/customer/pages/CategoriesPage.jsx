import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const flatCats = [];
                const seenIds = new Set();

                tree
                    .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
                    .forEach((header) => {
                        (header.children || []).forEach((cat) => {
                            if (!seenIds.has(cat._id)) {
                                seenIds.add(cat._id);
                                flatCats.push({
                                    id: cat._id,
                                    name: cat.name,
                                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                                });
                            }
                        });
                    });
                setCategories(flatCats);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return (
        <div className="min-h-screen bg-[#FAF9F4]">
            <MainLocationHeader hideSearchBar={true} />
            <div className="max-w-3xl mx-auto px-6 pt-[140px] md:pt-[160px] pb-24">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E7D32]" />
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-x-6 sm:gap-x-8 md:gap-x-10 gap-y-10 md:gap-y-14">
                        {categories.map((category, idx) => (
                            <div 
                                key={category.id} 
                                className="flex flex-col group cursor-pointer text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <Link
                                    to={`/category/${category.id}`}
                                    className="block w-full"
                                >
                                    <div className="w-full aspect-square mb-3.5 relative flex items-center justify-center rounded-full bg-white hover:bg-slate-50/50 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-5 md:p-6">
                                        <img
                                            src={applyCloudinaryTransform(category.image)}
                                            alt={category.name}
                                            loading="lazy"
                                            className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                                        />
                                    </div>
                                    <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-bold text-[#2D3F51] tracking-tight leading-snug line-clamp-2 group-hover:text-[#2E7D32] transition-colors font-['Inter']">
                                        {category.name}
                                    </span>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesPage;
