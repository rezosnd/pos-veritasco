'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

const VEG_ICON = ({ isVeg }) => (
  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${isVeg ? 'border-green-500' : 'border-red-500'}`}>
    <span className={`w-2.5 h-2.5 rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
  </div>
);

export default function ItemCard({ item, qty, onAdd, onRemove, brandColor }) {
  const isVeg = item.type === 'veg' || item.type === 'vegan';
  const imageUrl = item.image
    ? item.image.startsWith('http') ? item.image : `${API_URL}${item.image}`
    : null;

  return (
    <div className="card p-4 flex gap-4 transition-all duration-200 hover:border-[#444]">
      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <VEG_ICON isVeg={isVeg} />
          <h3 className="font-semibold text-white text-sm leading-tight">{item.name}</h3>
        </div>
        {item.description && (
          <p className="text-[#71717a] text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] text-[#71717a] bg-[#242424] px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}
        <p className="font-bold text-sm mt-2" style={{ color: brandColor }}>₹{item.price}</p>
      </div>

      {/* Image + Add/Remove */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        {imageUrl && (
          <div className="w-24 h-20 rounded-xl overflow-hidden bg-[#242424]">
            <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <AnimatePresence mode="wait">
          {qty === 0 ? (
            <motion.button
              key="add"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAdd}
              className="w-full px-4 py-1.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: brandColor }}
            >
              ADD
            </motion.button>
          ) : (
            <motion.div
              key="qty"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2"
            >
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onRemove}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-[#333] text-white hover:border-red-400 hover:text-red-400 transition-all"
              >
                <Minus size={14} />
              </motion.button>
              <motion.span
                key={qty}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                className="w-5 text-center font-bold text-white text-sm"
              >
                {qty}
              </motion.span>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onAdd}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ background: brandColor }}
              >
                <Plus size={14} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
