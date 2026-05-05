'use client';

import { motion } from 'framer-motion';

export default function CategoryFilter({ categories, active, onChange, brandColor }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
      {categories.map((cat) => {
        const isActive = cat === active;
        return (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(cat)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={isActive
              ? { background: brandColor, color: 'white' }
              : { background: '#1a1a1a', color: '#a1a1aa', border: '1px solid #333' }
            }
          >
            {cat}
          </motion.button>
        );
      })}
    </div>
  );
}
