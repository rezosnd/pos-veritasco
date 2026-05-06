'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ShieldAlert, Loader2, UtensilsCrossed, CheckCircle2, XCircle } from 'lucide-react';
import { restaurantApi, sessionApi } from '@/lib/api';
import { validateLocation } from '@/lib/geo';
import useCartStore from '@/store/cartStore';

import { Suspense } from 'react';

function StartPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useCartStore((s) => s.setSession);
  const clearCart = useCartStore((s) => s.clearCart);

  const rid = searchParams.get('rid');
  const table = searchParams.get('table');

  const [step, setStep] = useState('loading'); // loading | gps | validating | blocked | error | success
  const [restaurant, setRestaurant] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [distance, setDistance] = useState(null);

  const initFlow = useCallback(async () => {
    if (!rid || !table) {
      setStep('error');
      setErrorMsg('Invalid QR code. Please scan the correct QR at your table.');
      return;
    }
    try {
      // 1. Fetch restaurant public data
      const restRes = await restaurantApi.getPublic(rid);
      const rest = restRes.data.restaurant;
      setRestaurant(rest);

      // 2. Apply branding immediately
      document.documentElement.style.setProperty('--brand-color', rest.theme_color || '#e85d04');

      // 3. Check table status
      const tableRes = await sessionApi.getByTable(rid, table);
      if (tableRes.data?.session) {
        // 4. GPS validation (if enabled)
        if (rest.features?.gps_validation !== false) {
          setStep('gps');
          const geo = await validateLocation(rest.latitude, rest.longitude, rest.geo_radius_meters || 100);
          if (!geo.allowed) {
            setDistance(geo.distance);
            if (geo.error) {
              setErrorMsg(geo.error);
              setStep('error');
            } else {
              setStep('blocked');
              setDistance(geo.distance);
            }
            return;
          }
        }
        // 5. Valid — set session and go to menu
        const session = tableRes.data.session;
        setSession(session._id, rid, table);
        clearCart();
        setStep('success');
        setTimeout(() => router.push(`/menu?rid=${rid}&table=${table}&sid=${session._id}`), 1000);
      }
    } catch (err) {
      if (err.message?.includes('TABLE_INACTIVE') || err.message?.includes('not active')) {
        setStep('blocked');
        setErrorMsg('table_inactive');
      } else if (err.message?.includes('NO_SESSION')) {
        setStep('blocked');
        setErrorMsg('table_inactive');
      } else {
        setStep('error');
        setErrorMsg(err.message || 'Something went wrong. Please try again.');
      }
    }
  }, [rid, table, router, setSession, clearCart]);

  useEffect(() => {
    initFlow();
  }, [initFlow]);

  const bg = restaurant?.theme_color || '#e85d04';

  const states = {
    loading: (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse"
          style={{ background: `linear-gradient(135deg, ${bg}, ${bg}99)` }}>
          <UtensilsCrossed size={36} className="text-white" />
        </div>
        <Loader2 size={24} className="animate-spin mx-auto mb-4 text-[#a1a1aa]" />
        <p className="text-[#a1a1aa]">Verifying your table...</p>
      </motion.div>
    ),
    gps: (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <MapPin size={36} className="text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Verifying Location</h2>
        <p className="text-[#a1a1aa]">Please allow location access to confirm you're at the restaurant.</p>
      </motion.div>
    ),
    blocked: (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="w-20 h-20 rounded-full bg-slate-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={36} className="text-slate-400" />
        </div>
        {errorMsg === 'table_inactive' ? (
          <>
            <h2 className="text-xl font-bold text-white mb-3">Table Not Active</h2>
            <p className="text-[#a1a1aa]">
              This table hasn't been activated yet. Please ask your waiter to activate it.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white mb-3">Access Restricted</h2>
            <p className="text-[#f5f5f5] font-medium mb-2">You must be inside the restaurant to order</p>
            {distance && (
              <p className="text-[#a1a1aa] text-sm">
                You're approximately <span className="text-slate-400 font-bold">{distance}m</span> away.
                (Allowed: {restaurant?.geo_radius_meters || 100}m)
              </p>
            )}
          </>
        )}
      </motion.div>
    ),
    error: (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="w-20 h-20 rounded-full bg-slate-500/20 flex items-center justify-center mx-auto mb-6">
          <XCircle size={36} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-[#a1a1aa] text-sm mb-6">{errorMsg}</p>
        <button onClick={initFlow} className="btn-brand">Try Again</button>
      </motion.div>
    ),
    success: (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={36} className="text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Welcome to {restaurant?.name}!</h2>
        <p className="text-[#a1a1aa]">Taking you to the menu...</p>
      </motion.div>
    ),
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      {/* Brand glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${bg}22 0%, transparent 70%)` }} />
      </div>

      {/* Restaurant header */}
      {restaurant && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 z-10">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 border-2"
              style={{ borderColor: bg }} />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: `linear-gradient(135deg, ${bg}, ${bg}99)` }}>
              <UtensilsCrossed size={32} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-display text-white">{restaurant.name}</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Table {table}</p>
        </motion.div>
      )}

      {/* State content */}
      <div className="card p-8 w-full max-w-sm z-10">
        <AnimatePresence mode="wait">
          <div key={step}>{states[step]}</div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <UtensilsCrossed size={48} className="text-[#333] animate-pulse" />
      </div>
    }>
      <StartPageContent />
    </Suspense>
  );
}
