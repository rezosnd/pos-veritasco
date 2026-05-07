'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Star, Leaf, Flame, MapPin, Clock, Phone, Wifi, WifiOff, Receipt, ShieldAlert, ChevronRight, Check, Coffee, Pizza, Croissant, Utensils, Sandwich, IceCream, CupSoda } from 'lucide-react';
import { menuApi, tableApi, sessionApi, getBackendUrl, getFullUrl } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { connectSocket } from '@/lib/socket';
import useCartStore from '@/store/cartStore';
import useAuthStore from '@/store/authStore';
import { validateLocation, haversineDistance } from '@/lib/geo';

const BACKEND_URL = getBackendUrl();

// Professional icons for categories to look like Zomato
const CAT_ICONS = {
  'Fast Food': <Utensils size={28} strokeWidth={1.5} />,
  'Chicken': <Flame size={28} strokeWidth={1.5} />,
  'Burgers': <Sandwich size={28} strokeWidth={1.5} />,
  'Sandwiches': <Sandwich size={28} strokeWidth={1.5} />,
  'Coffee': <Coffee size={28} strokeWidth={1.5} />,
  'Pizza': <Pizza size={28} strokeWidth={1.5} />,
  'Desserts': <IceCream size={28} strokeWidth={1.5} />,
  'Beverages': <CupSoda size={28} strokeWidth={1.5} />,
  'Breads': <Croissant size={28} strokeWidth={1.5} />,
  'All': <Utensils size={28} strokeWidth={1.5} />,
};

export default function MenuPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');
  const token = searchParams.get('token');
  const { restaurant, loading: restLoading } = useRestaurant();

  const [geoState, setGeoState] = useState('checking'); // checking | ok | denied | skipped
  const [qrError, setQrError] = useState(false);
  const [tableStatus, setTableStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [activating, setActivating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const { cart, addItem, removeItem, getItemQty, totalItems, subtotal } = useCartStore();
  const cartCount = totalItems();

  // ── Geo validation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurant) return;
    const bypassGeo = process.env.NEXT_PUBLIC_BYPASS_GEO === 'true';
    if (bypassGeo || !restaurant.latitude || !restaurant.longitude) {
      setGeoState('ok');
      return;
    }
    validateLocation(restaurant.latitude, restaurant.longitude, restaurant.geo_radius_meters || 100)
      .then(result => {
        if (result.error) {
          toast.error(result.error, { duration: 6000 });
          setGeoState('error');
        } else if (result.allowed) {
          setGeoState('ok');
        } else {
          toast.error(`You appear to be ${result.distance}m from ${restaurant.name}. You must be inside to order.`, { duration: 6000 });
          setGeoState('denied');
        }
      })
      .catch((err) => {
        toast.error('Location verification failed. Please ensure location services are enabled.');
        setGeoState('error');
      });
  }, [restaurant]);

  // ── Load table + menu ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurant || !tableNumber) return;
    if (geoState !== 'ok') return;

    Promise.all([
      tableApi.getPublic(restaurant._id, tableNumber, token),
      menuApi.getAll(restaurant._id, { is_available: true }),
      menuApi.getCategories(restaurant._id),
    ]).then(([tRes, mRes, cRes]) => {
      setTableStatus(tRes.data.table);
      setMenu(mRes.data.items || []);
      setCategories(['All', ...(cRes.data.categories || [])]);
      if (['active','occupied'].includes(tRes.data.table?.status) && tRes.data.table?.current_session_id) {
        setSession({ _id: tRes.data.table.current_session_id });
      }
    }).catch(err => {
      if (err.message?.toLowerCase().includes('invalid qr')) {
        setQrError(true);
      } else {
        toast.error(err.message);
      }
    });
  }, [restaurant, tableNumber, token, geoState]);

  // ── Self-activate table ─────────────────────────────────────────────────────
  const handleSelfActivate = async (e) => {
    e.preventDefault();
    if (!customerName || !customerPhone) return toast.error('Please enter name and mobile number');
    setActivating(true);
    try {
      const res = await tableApi.publicActivate(restaurant._id, tableNumber, {
        customer_name: customerName,
        customer_phone: customerPhone,
        token: token
      });
      const { table, session: newSession } = res.data;
      setTableStatus(table);
      setSession(newSession);
      toast.success(`Welcome ${customerName}! Start ordering.`);
    } catch (err) {
      toast.error(err.message || 'Could not activate table');
    } finally {
      setActivating(false);
    }
  };

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?._id) return;
    const socket = connectSocket();
    socket.emit('join-session', { session_id: session._id });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('cart-updated', (data) => {
      useCartStore.getState().setCart(data.cart);
    });
    socket.on('session-closed', () => {
      const isStaff = !!useAuthStore.getState().user;
      if (isStaff) {
        toast.success('Table closed.', { duration: 2000 });
        setTimeout(() => { window.location.href = `/${restaurant?.slug}/waiter`; }, 1500);
      } else {
        toast.success('Session has ended. Redirecting...', { duration: 4000 });
        useCartStore.getState().clearCart();
        setTimeout(() => { window.location.href = 'https://veritasco.tech'; }, 3000);
      }
    });
    return () => { 
      socket.off('cart-updated'); 
      socket.off('session-closed');
    };
  }, [session?._id]);

  const filtered = menu.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const brand = restaurant?.theme_color || 'var(--brand-600)'; // default zomato red
  const logoUrl = getFullUrl(restaurant?.logo);

  // ── Loading / Checking ──────────────────────────────────────────────────────
  if (restLoading || geoState === 'checking') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-gray-100">
          {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: brand }} />}
        </div>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand }} />
        <p className="text-gray-500 text-sm font-medium">Verifying your location...</p>
      </div>
    );
  }

  // ── Invalid QR Code ───────────────────────────────────────────────────────
  if (qrError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
          <ShieldAlert className="w-8 h-8 text-slate-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Invalid QR Code</h1>
        <p className="text-gray-500 text-sm">This link is invalid or has expired. Please scan the physical QR code on your table to access the menu.</p>
      </div>
    );
  }

  if (geoState === 'denied') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center animate-bounce">
          <MapPin size={32} className="text-slate-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Outside Boundary</h1>
        <p className="text-gray-500 text-sm max-w-xs">You must be inside <span className="text-gray-900 font-semibold">{restaurant?.name}</span> to place orders.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm mt-4 active:scale-95 transition-all" style={{ background: brand }}>
          Retry Location Verification
        </button>
      </div>
    );
  }

  if (geoState === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center">
          <ShieldAlert size={32} className="text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Location Required</h1>
        <p className="text-gray-500 text-sm max-w-xs">Please allow location permissions for this website or enable your GPS.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm mt-4 active:scale-95 transition-all" style={{ background: brand }}>
          Enable GPS & Retry
        </button>
      </div>
    );
  }

  // ── Table not active ────────────────────────────────────────────────────────
  if (tableStatus && !['active','occupied'].includes(tableStatus.status)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Full screen background image */}
        <div className="absolute inset-0 z-0">
          <img src="/premium-hero.png" alt="Restaurant Background" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
        </div>

        <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 text-center relative z-10 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2" style={{ background: brand }} />
          
          {logoUrl && (
            <motion.img initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
              src={logoUrl} alt={restaurant.name}
              className="max-h-16 w-auto mx-auto mb-4 object-contain drop-shadow-md" />
          )}
          <motion.h1 initial={{y:10,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}}
            className="text-3xl font-bold text-white mb-1 drop-shadow-lg">{restaurant?.name}</motion.h1>
          <p className="text-white/80 font-medium text-sm mb-6 uppercase tracking-wider">Table {tableNumber}</p>

          <form onSubmit={handleSelfActivate} className="space-y-4 text-left">
            <div>
              <label className="text-[11px] text-white/80 font-bold mb-1.5 block uppercase tracking-wider">Your Name</label>
              <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/40 focus:outline-none focus:bg-black/60 focus:border-white/40 transition-all backdrop-blur-md" />
            </div>
            <div>
              <label className="text-[11px] text-white/80 font-bold mb-1.5 block uppercase tracking-wider">Mobile Number</label>
              <input type="tel" required value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                placeholder="10-digit number" pattern="[0-9]{10}"
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/40 focus:outline-none focus:bg-black/60 focus:border-white/40 transition-all backdrop-blur-md" />
            </div>
            
            <motion.button whileTap={{scale:0.97}} type="submit" disabled={activating}
              className="w-full py-4 mt-6 rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2 shadow-2xl disabled:opacity-70 transition-all"
              style={{ background: brand }}>
              {activating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Start Ordering'}
            </motion.button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Menu UI (Zomato Style) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-32 font-sans">
      
      {/* ── Header ── */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Logo" className="max-h-9 w-auto object-contain" />}
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{restaurant?.name}</h1>
              <p className="text-xs text-gray-500 font-medium">Table {tableNumber} • Dining in</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg border border-blue-100">
              {connected ? <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> : <WifiOff size={12} className="text-gray-400" />}
              <span className="text-[10px] font-bold text-blue-700">LIVE</span>
            </div>
            {session?._id && (
              <button onClick={() => router.push(`/${params.slug}/bill?session=${session._id}&table=${tableNumber}`)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors">
                <Receipt size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search for dishes..."
              className="w-full bg-white border border-gray-200 shadow-[0_2px_8px_rgb(0,0,0,0.04)] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-50 transition-all"
            />
          </div>
        </div>
      </header>

      {/* ── Top Categories (Zomato Icon Style) ── */}
      <div className="bg-white mb-2 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Top Categories</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat, idx) => {
              const catName = typeof cat === 'string' ? cat : cat.name;
              const catImage = typeof cat === 'object' ? cat.image : null;
              const imgUrl = getFullUrl(catImage);
              const isActive = activeCategory === catName;
              return (
              <div key={catName || idx} onClick={() => setActiveCategory(catName)} className="flex flex-col items-center gap-2 cursor-pointer shrink-0">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all overflow-hidden relative ${isActive ? 'shadow-md border-2 text-gray-900' : 'bg-gray-50 border border-gray-100 text-gray-400'}`}
                  style={{ borderColor: isActive ? brand : 'transparent', background: isActive ? `${brand}10` : '' }}>
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 opacity-50">
                    {CAT_ICONS[catName] || <Utensils size={28} strokeWidth={1.5} />}
                  </div>
                  {imgUrl && (
                    <img src={imgUrl} alt={catName} loading="lazy" onError={(e) => { e.target.style.opacity = '0'; }} className="relative z-10 w-full h-full object-contain transition-opacity" />
                  )}
                </div>
                <span className={`text-[11px] font-semibold text-center leading-tight ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {catName}
                </span>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* ── Menu List ── */}
      <div className="max-w-2xl mx-auto px-4 space-y-4 pt-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">🔍</div>
            <p className="text-gray-500 font-medium">No dishes found</p>
            <p className="text-sm text-gray-400 mt-1">Try searching for something else</p>
          </div>
        )}
        
        {filtered.map(item => {
          const qty = cart.find(c => c.menu_item_id === item._id)?.quantity || 0;
          const imgUrl = getFullUrl(item.image);
          
          return (
            <motion.div key={item._id} layout
              className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-gray-100 flex gap-4">
              
              {/* Info Left */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {item.is_veg !== undefined && (
                      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${item.is_veg ? 'border-blue-600' : 'border-slate-600'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-blue-600' : 'bg-slate-600'}`} />
                      </div>
                    )}
                    {item.is_bestseller && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[var(--brand-600)] bg-[var(--brand-600)]/10 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> Bestseller
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px] leading-snug">{item.name}</h3>
                  <div className="font-semibold text-gray-900 text-sm mt-1">₹{item.price}</div>
                  {item.description && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{item.description}</p>}
                </div>
              </div>

              {/* Image & Add Button Right */}
              <div className="w-[110px] shrink-0 flex flex-col items-center">
                <div className="w-full h-[110px] rounded-2xl overflow-hidden shadow-sm bg-gray-50 border border-gray-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-3xl bg-gray-50 opacity-50">🍽️</div>
                  {imgUrl && (
                    <img src={imgUrl} alt={item.name} loading="lazy" onError={(e) => { e.target.style.opacity = '0'; }} className="relative z-10 w-full h-full object-cover transition-opacity" />
                  )}
                </div>
                
                {/* Zomato style ADD button overlaying the image slightly */}
                <div className="-mt-4 relative z-10 w-24">
                  {qty === 0 ? (
                    <button onClick={() => addItem({ menu_item_id: item._id, name: item.name, price: item.price, quantity: 1 })}
                      className="w-full py-1.5 bg-white border border-gray-200 text-slate-500 font-bold text-sm rounded-lg shadow-sm hover:bg-gray-50 active:scale-95 transition-all uppercase tracking-wider"
                      style={{ color: brand, borderColor: `${brand}40` }}>
                      ADD
                    </button>
                  ) : (
                    <div className="w-full h-[34px] bg-white border rounded-lg shadow-sm flex items-center justify-between overflow-hidden"
                      style={{ borderColor: brand }}>
                      <button onClick={() => removeItem(item._id)} className="w-8 h-full flex items-center justify-center bg-gray-50 active:bg-gray-100">
                        <Minus size={14} style={{ color: brand }} />
                      </button>
                      <span className="font-bold text-sm" style={{ color: brand }}>{qty}</span>
                      <button onClick={() => addItem({ menu_item_id: item._id, name: item.name, price: item.price, quantity: 1 })} className="w-8 h-full flex items-center justify-center bg-gray-50 active:bg-gray-100">
                        <Plus size={14} style={{ color: brand }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Bottom Floating Bar ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-white via-white/90 to-transparent pt-12">
            <div className="max-w-2xl mx-auto">
              <button onClick={() => router.push(`/${params.slug}/cart?table=${tableNumber}&session=${session?._id || ''}`)}
                className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-between px-5 text-base shadow-[0_8px_20px_rgb(22,163,74,0.3)] active:scale-[0.98] transition-transform"
                style={{ background: brand, boxShadow: `0 8px 24px ${brand}40` }}>
                <div className="flex flex-col items-start">
                  <span className="text-[11px] uppercase tracking-wider opacity-90">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</span>
                  <span>₹{subtotal()}</span>
                </div>
                <span className="flex items-center gap-2">
                  View Cart <ChevronRight size={18} />
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
