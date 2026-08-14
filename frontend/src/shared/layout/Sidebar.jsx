import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { HiChevronDown } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import LogoImage from "@/assets/Logo.png";

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) => {
  const location = useLocation();
  const badgeCount = Number(item?.badgeCount || 0);
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "w-full flex items-center justify-between rounded-xl px-3 pr-12 py-2.5 transition-all duration-200 group relative overflow-hidden",
            isChildActive || isOpen
              ? "bg-sky-100 text-sky-900 font-bold border border-sky-200/80 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
          )}>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-slate-100/80 rounded-xl -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center space-x-2.5 z-10">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-300 shadow-xs",
                isChildActive || isOpen
                  ? "bg-sky-500 text-white ring-2 ring-sky-200"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700",
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-xs tracking-tight transition-all duration-200",
                isChildActive || isOpen ? "font-bold" : "font-semibold",
              )}>
              {item.label}
            </span>
          </div>
          {badgeCount > 0 && !isOpen && (
            <span className="pointer-events-none absolute top-2.5 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-rose-500/20 ring-2 ring-white">
              {badgeLabel}
            </span>
          )}
          <div
            className={cn(
              "transition-all duration-200 z-10",
              isOpen
                ? "rotate-180 text-sky-600"
                : "rotate-0 text-slate-400 group-hover:text-slate-600",
            )}>
            <HiChevronDown className="h-4 w-4" />
          </div>
        </button>
        {isOpen && (
          <div className="pl-9 pr-3 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-300">
            {item.children.map((child) => {
              const showChildBadge =
                badgeCount > 0 && String(child?.path || "") === "/admin/support-tickets";

              return (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-2 px-3 rounded-lg transition-all duration-200 relative",
                    isActive
                      ? "text-sky-900 font-bold bg-sky-100 border border-sky-200 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/70",
                    showChildBadge && "pr-9",
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-r-full bg-sky-500 shadow-xs" />
                    )}
                    {child.label}
                    {showChildBadge && (
                      <span className="pointer-events-none absolute top-1.5 right-2 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-rose-500/20 ring-2 ring-white">
                        {badgeLabel}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.end !== undefined ? item.end : false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 group relative overflow-hidden",
          isActive
            ? "bg-[#3b1754] text-white font-bold shadow-md shadow-purple-950/20"
            : "text-slate-700 hover:text-purple-950 hover:bg-purple-100/80",
        )
      }>
      {({ isActive }) => (
        <>
          <AnimatePresence>
            {isHovered && !isActive && (
              <motion.div
                layoutId="hover-highlight"
                className="absolute inset-0 bg-purple-100/60 rounded-xl -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-300 shadow-xs z-10",
              isActive
                ? "bg-white/20 text-white"
                : "bg-purple-100/80 text-purple-700 group-hover:bg-purple-200 group-hover:text-purple-900",
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "text-xs tracking-tight transition-all duration-200 z-10",
              isActive ? "font-bold" : "font-semibold",
            )}>
            {item.label}
          </span>
          {badgeCount > 0 && (
            <span className="pointer-events-none absolute top-2.5 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-rose-500/20 ring-2 ring-white z-10">
              {badgeLabel}
            </span>
          )}
          {isActive && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/40 rounded-l-full animate-in slide-in-from-right-1" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({ items, title, onClose, openMenu, handleToggle, hoveredIdx, setHoveredIdx }) => {
  const { settings } = useSettings();
  const appName = settings?.appName || 'App';
  const logoUrl = settings?.logoUrl || LogoImage;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f5f3ff] border-r border-purple-100/80">
      <div className="flex-shrink-0 flex h-16 items-center justify-between px-5 border-b border-purple-100/80 bg-purple-100/40 z-10">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 flex items-center justify-center shrink-0">
            <img 
              src={logoUrl} 
              onError={(e) => {
                e.currentTarget.src = LogoImage;
              }}
              alt={appName} 
              className="h-full w-full object-contain drop-shadow-sm scale-110" 
            />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              {appName}
            </h1>
            <span className="text-[9px] font-black text-purple-700 uppercase tracking-[0.2em] mt-1 block">
              {title}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="p-2 md:hidden text-purple-400 hover:text-purple-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className="mt-4 px-3 space-y-1 flex-1 overflow-y-auto overscroll-contain custom-scrollbar min-h-0 pb-6 relative z-20"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <p className="px-3 text-[9px] font-black text-purple-400 uppercase tracking-[0.3em] mb-2.5">
          Core Management
        </p>
        <AnimatePresence>
          {items.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              isOpen={openMenu === item.label}
              onToggle={() => handleToggle(item.label)}
              isHovered={hoveredIdx === idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseEnterWithClose={() => {
                setHoveredIdx(idx);
              }}
              onMouseLeave={() => { }} // Handle in nav container
            />
          ))}
        </AnimatePresence>
      </nav>

      <div className="p-4 border-t border-purple-100/80 bg-purple-100/40 flex-shrink-0">
        <div className="bg-white/90 rounded-xl p-3 shadow-xs border border-purple-200/80 hover:bg-white hover:border-purple-300 transition-all group cursor-pointer">
          <div className="flex items-center space-x-2.5">
            <div className="relative group shrink-0">
              <div className="h-10 w-10 flex items-center justify-center">
                <img 
                  src={logoUrl} 
                  onError={(e) => {
                    e.currentTarget.src = LogoImage;
                  }}
                  alt={appName} 
                  className="h-full w-full object-contain scale-105" 
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white shadow-xs animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                {title?.toLowerCase().includes('seller') ? 'Seller Console' : 'Admin Console'}
              </p>
              <p className="text-[9px] text-purple-400 truncate font-black uppercase tracking-widest">
                {title?.toLowerCase().includes('seller') ? 'Seller' : 'Super Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, onClose }) => {
  const { role } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const commonProps = {
    items,
    title,
    onClose,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed left-0 inset-y-0 w-72 bg-white text-slate-600 border-r border-slate-200/80 shadow-[4px_0_24px_rgba(0,0,0,0.03)] md:flex flex-col z-50 transition-all duration-300",
        (role === "admin" || role === "seller") ? "hidden md:flex" : "flex",
      )}>
        <SidebarContent {...commonProps} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
            />

            {/* Outer Container (Fixed Shell - NO TRANSFORM) */}
            <div className="absolute left-0 inset-y-0 w-72 flex flex-col pointer-events-none">
              {/* Inner Animation Wrapper (TRANSFORM APPLIED HERE) */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className="flex-1 bg-white shadow-2xl flex flex-col pointer-events-auto min-h-0 border-r border-slate-200"
              >
                <SidebarContent {...commonProps} />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
