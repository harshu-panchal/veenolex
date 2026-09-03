import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, Check, ChevronsRight } from 'lucide-react';

const SlideToPay = ({
    onSuccess,
    amount,
    isLoading = false,
    disabled = false,
    text = "Slide to Pay"
}) => {
    const [isCompleted, setIsCompleted] = useState(false);
    const controls = useAnimation();
    const x = useMotionValue(0);
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(360);
    const sliderWidth = 56; // Width of the sliding circle (w-14)

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth || containerRef.current.getBoundingClientRect().width;
                if (width > 0) {
                    setContainerWidth(width);
                }
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        const timer1 = setTimeout(updateWidth, 50);
        const timer2 = setTimeout(updateWidth, 300);

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            resizeObserver = new ResizeObserver(() => {
                updateWidth();
            });
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateWidth);
            clearTimeout(timer1);
            clearTimeout(timer2);
            if (resizeObserver) resizeObserver.disconnect();
        };
    }, []);

    // Maximum drag distance
    const maxDrag = Math.max(0, containerWidth - sliderWidth - 8);

    // Transform values with safety non-zero range
    const safeMax = Math.max(1, maxDrag);
    const textOpacity = useTransform(x, [0, safeMax * 0.5], [1, 0]);
    const shimmerOpacity = useTransform(x, [0, safeMax * 0.3], [1, 0]);
    const rotate = useTransform(x, [0, safeMax], [0, 360]);
    const arrowsOpacity = useTransform(x, [0, safeMax * 0.8], [1, 0]);
    const checkOpacity = useTransform(x, [safeMax * 0.5, safeMax], [0, 1]);
    const fillWidth = useTransform(x, [0, safeMax], [sliderWidth, containerWidth]);

    const isLocked = isCompleted || isLoading || disabled;

    const handleDragEnd = async () => {
        const currentX = x.get();
        if (maxDrag > 0 && currentX >= maxDrag * 0.8) {
            setIsCompleted(true);
            controls.start({ x: maxDrag });
            if (onSuccess) {
                try {
                    await onSuccess();
                } catch {
                    // Handled upstream
                } finally {
                    setIsCompleted(false);
                    controls.start({ x: 0 });
                }
            } else {
                setIsCompleted(false);
                controls.start({ x: 0 });
            }
        } else {
            controls.start({ x: 0 });
        }
    };

    return (
        <div
            ref={containerRef}
            className={`relative h-16 w-full rounded-full overflow-hidden select-none touch-none shadow-[0_18px_45px_rgba(4,120,87,0.35)] border border-white/10 ${
                disabled ? 'bg-slate-700 opacity-60 cursor-not-allowed' : 'bg-linear-to-r from-primary via-primary to-primary'
            }`}
        >
            {/* Progress Fill */}
            <motion.div
                className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
                style={{ width: fillWidth }}
            />

            {/* Shimmer Effect Background */}
            {!isLocked && (
                <motion.div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ opacity: shimmerOpacity }}
                >
                    <motion.div
                        className="absolute inset-y-0 -inset-x-1 bg-linear-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                    />
                </motion.div>
            )}

            {/* Text Label */}
            <motion.div
                className="absolute inset-y-0 left-16 right-12 flex items-center justify-center z-10 pointer-events-none"
                style={{ opacity: isCompleted ? 0 : textOpacity }}
            >
                <span className="text-white font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 w-full text-center">
                    {text} <span className="text-white/40">|</span> <span className="text-brand-50 font-extrabold">₹{amount}</span>
                </span>

                {!isLocked && (
                    <div className="absolute right-4 animate-pulse text-white/70">
                        <ChevronsRight size={20} />
                    </div>
                )}
            </motion.div>

            {/* Success/Processing State Text */}
            {isCompleted && (
                <motion.div
                    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                >
                    <span className="text-white font-black text-lg tracking-wide flex items-center gap-2">
                        Processing <span className="animate-pulse">...</span>
                    </span>
                </motion.div>
            )}

            {/* Draggable Circle */}
            <motion.div
                className={`absolute left-1 top-1 bottom-1 w-14 h-14 bg-white rounded-full flex items-center justify-center z-20 shadow-[0_6px_18px_rgba(15,118,110,0.35)] border border-brand-100 ${
                    isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing'
                }`}
                drag={!isLocked ? "x" : false}
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0.05}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x }}
                whileTap={!isLocked ? { scale: 0.95 } : undefined}
                whileHover={!isLocked ? { scale: 1.05 } : undefined}
            >
                {isLoading || isCompleted ? (
                    <motion.div
                        className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
                    />
                ) : (
                    <motion.div
                        className="relative w-full h-full flex items-center justify-center"
                        style={{ rotate }}
                    >
                        <motion.div className="text-primary" style={{ opacity: arrowsOpacity }}>
                            <ChevronRight size={28} strokeWidth={3} />
                        </motion.div>
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center text-primary"
                            style={{ opacity: checkOpacity }}
                        >
                            <Check size={24} strokeWidth={3} />
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default SlideToPay;


