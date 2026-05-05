'use client';

import { motion } from 'framer-motion';
import { ShoppingCart, ChevronRight } from 'lucide-react';

export default function FloatingCart({ totalItems, totalPrice, brandColor, onClick }) {
  return (
    <motion.button
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="fixed bottom-6 left-4 right-4 z-50 max-w-2xl mx-auto"
      style={{ left: '1rem', right: '1rem' }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-2xl shadow-float"
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
      >
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <ShoppingCart size={18} className="text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-bold text-sm">{totalItems} item{totalItems !== 1 ? 's' : ''} in cart</p>
          <p className="text-white/80 text-xs">Tap to review</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white font-bold">₹{totalPrice.toFixed(2)}</span>
          <ChevronRight size={18} className="text-white/80" />
        </div>
      </div>
    </motion.button>
  );
}
