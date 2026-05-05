'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const TYPES = {
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  error:   { icon: AlertCircle,  color: 'text-red-400',   bg: 'bg-red-400/10 border-red-400/20' },
  warning: { icon: AlertTriangle,color: 'text-yellow-400',bg: 'bg-yellow-400/10 border-yellow-400/20' },
  info:    { icon: Info,         color: 'text-blue-400',  bg: 'bg-blue-400/10 border-blue-400/20' },
};

export default function Alert({ type = 'info', title, message, onClose, className = '' }) {
  const cfg = TYPES[type] || TYPES.info;
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${className}`}
    >
      <Icon size={18} className={`${cfg.color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {title && <p className={`font-semibold text-sm ${cfg.color}`}>{title}</p>}
        {message && <p className="text-sm text-[#a1a1aa] mt-0.5">{message}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-[#71717a] hover:text-white shrink-0 transition-colors">
          <X size={16} />
        </button>
      )}
    </motion.div>
  );
}
