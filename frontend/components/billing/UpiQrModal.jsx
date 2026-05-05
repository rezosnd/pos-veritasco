'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function UpiQrModal({ upiUrl, amount, restaurantName, brandColor, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="card p-6 w-full max-w-sm text-center"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white text-lg">Pay via UPI</h3>
          <button onClick={onClose} className="text-[#71717a] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-[#a1a1aa] text-sm mb-4">Scan with any UPI app to pay</p>

        <div className="bg-white p-4 rounded-2xl inline-block mb-4">
          <QRCodeSVG value={upiUrl} size={200} level="H" includeMargin={false} />
        </div>

        <div className="mb-4">
          <p className="text-3xl font-bold font-display" style={{ color: brandColor }}>
            ₹{amount?.toFixed(2)}
          </p>
          <p className="text-[#71717a] text-sm">{restaurantName}</p>
        </div>

        <div className="flex gap-2 justify-center text-xs text-[#71717a]">
          <span>Works with</span>
          {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
            <span key={app} className="bg-[#242424] px-2 py-0.5 rounded-full">{app}</span>
          ))}
        </div>

        <p className="text-xs text-[#555] mt-4">
          After payment, ask your waiter to confirm.
        </p>
      </motion.div>
    </div>
  );
}
