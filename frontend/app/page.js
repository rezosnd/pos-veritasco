'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { QrCode, ChefHat, BarChart3, Shield, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: QrCode,    title: 'QR Table Ordering',   desc: 'Customers scan, order & pay — no app needed',          color: 'var(--brand-600)' },
  { icon: ChefHat,   title: 'Kitchen Display',      desc: 'Orders appear live on kitchen screens instantly',      color: 'var(--brand-600)' },
  { icon: BarChart3, title: 'Live Analytics',       desc: 'Daily revenue, top items & CSV exports',               color: 'var(--brand-600)' },
  { icon: Shield,    title: 'Multi-Restaurant',     desc: 'One platform, unlimited outlets',                      color: 'var(--brand-600)' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfd]">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-sm p-1">
            <img src="/logo.avif" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-gray-900 text-xl font-display tracking-tight">Veritasco POS</span>
        </div>
        <Link href="/login">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 hover:shadow-lg"
            style={{ background: 'var(--brand-600)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            Sign In <ArrowRight size={16} />
          </button>
        </Link>
      </header>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden flex-1 flex flex-col">
        {/* Big image strip */}
        <div className="w-full h-[400px] sm:h-[500px] relative">
          <img src="/premium-hero.png" alt="Restaurant" className="w-full h-full object-cover" style={{ filter: 'brightness(0.5)' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#fdfdfd] via-transparent to-transparent" />
          {/* Hero text over image */}
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <div className="inline-block px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-bold mb-5 text-white bg-[var(--brand-600)]/90 backdrop-blur-md shadow-sm">
                Restaurant Management Platform
              </div>
              <h1 className="text-5xl sm:text-6xl font-extrabold text-white font-display leading-tight mb-6 drop-shadow-md">
                Smart POS for<br />Modern Restaurants
              </h1>
              <Link href="/login">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg mt-2 transition-all hover:bg-[var(--brand-700)]"
                  style={{ background: 'var(--brand-600)', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}
                >
                  Get Started <ArrowRight size={20} />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* ── Feature Cards ── */}
        <div className="max-w-6xl mx-auto w-full px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Everything you need</h2>
            <p className="text-gray-500 text-sm font-medium">Tools to run a restaurant smoothly and efficiently.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300"
                  style={{ background: `${f.color}10`, color: f.color }}>
                  <f.icon size={24} />
                </div>
                <p className="font-bold text-gray-900 text-lg mb-2">{f.title}</p>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-xs text-gray-400 font-medium border-t border-gray-100 bg-white">
        © {new Date().getFullYear()} Veritasco · All rights reserved
      </footer>
    </div>
  );
}
