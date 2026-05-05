'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { UtensilsCrossed, QrCode, ChefHat, BarChart3, Shield, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const features = [
    { icon: QrCode, title: 'QR Ordering', desc: 'GPS-validated table QR codes', color: '#e85d04' },
    { icon: ChefHat, title: 'Kitchen Display', desc: 'Real-time order tracking', color: '#f97316' },
    { icon: BarChart3, title: 'Analytics', desc: 'Revenue & item insights', color: '#22c55e' },
    { icon: Shield, title: 'Multi-Tenant', desc: 'Unlimited restaurants', color: '#8b5cf6' },
  ];
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #e85d04, #f97316)' }}>
          <UtensilsCrossed size={36} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold font-display text-white mb-4">Restaurant POS</h1>
        <p className="text-[#a1a1aa] text-lg mb-8">Production-ready multi-tenant POS & QR ordering system</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          {features.map(f => (
            <div key={f.title} className="card p-4 text-left">
              <f.icon size={20} style={{ color: f.color }} className="mb-2" />
              <p className="font-semibold text-white text-sm">{f.title}</p>
              <p className="text-xs text-[#71717a]">{f.desc}</p>
            </div>
          ))}
        </div>
        <Link href="/login">
          <motion.button whileTap={{ scale: 0.97 }}
            className="btn-brand flex items-center gap-2 mx-auto px-8 py-4 text-lg"
            style={{ background: 'linear-gradient(135deg, #e85d04, #f97316)' }}>
            Get Started <ArrowRight size={20} />
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
}
