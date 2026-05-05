'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Star, Leaf, Flame, MapPin, Clock, Phone, Wifi, WifiOff, Receipt } from 'lucide-react';
import { menuApi, tableApi, sessionApi } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { connectSocket } from '@/lib/socket';
import useCartStore from '@/store/cartStore';
import { validateLocation, haversineDistance } from '@/lib/geo';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

function ItemImage({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
        <span className="text-3xl opacity-30">🍽️</span>
      </div>
    );
  }
  const url = src.startsWith('http') ? src : `${BACKEND_URL}${src}`;
  return <img src={url} alt={alt} className="w-full h-full object-cover" onError={() => setErr(true)} />;
}

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

    // Bypass geo: dev mode OR explicit env flag
    const bypassGeo = process.env.NODE_ENV === 'development'
      || process.env.NEXT_PUBLIC_BYPASS_GEO === 'true';

    if (bypassGeo) {
      setGeoState('ok');
      return;
    }

    // No coordinates configured for restaurant — skip geo check
    if (!restaurant.latitude || !restaurant.longitude) {
      setGeoState('ok');
      return;
    }

    validateLocation(restaurant.latitude, restaurant.longitude, restaurant.geo_radius_meters || 100)
      .then(result => {
        if (result.error) {
          // Can't get location (denied / unsupported) — allow but warn
          console.warn('Geo check skipped:', result.error);
          setGeoState('skipped');
        } else if (result.allowed) {
          setGeoState('ok');
        } else {
          toast.error(`You appear to be ${result.distance}m from ${restaurant.name}. You must be inside to order.`, { duration: 6000 });
          setGeoState('denied');
        }
      })
      .catch(() => setGeoState('skipped')); // Any error → skip gracefully
  }, [restaurant]);

  // ── Load table + menu (always load menu, even if table inactive) ────────────
  useEffect(() => {
    if (!restaurant || !tableNumber) return;
    if (!['ok', 'skipped'].includes(geoState)) return; // don't load if denied or still checking

    Promise.all([
      tableApi.getPublic(restaurant._id, tableNumber, token),
      menuApi.getAll(restaurant._id, { is_available: true }),
      menuApi.getCategories(restaurant._id),
    ]).then(([tRes, mRes, cRes]) => {
      setTableStatus(tRes.data.table);
      setMenu(mRes.data.items || []);
      setCategories(['All', ...(cRes.data.categories || [])]);
      // If already active, get session
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

  // ── Self-activate table (customer taps 'Start Ordering') ──────────────────
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
      toast.success('Session has ended. Redirecting...', { duration: 4000 });
      useCartStore.getState().clearCart();
      setTimeout(() => {
        window.location.href = 'https://veritasco.tech';
      }, 3000);
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

  const brand = restaurant?.theme_color || '#e85d04';
  const logoUrl = restaurant?.logo ? (restaurant.logo.startsWith('http') ? restaurant.logo : `${BACKEND_URL}${restaurant.logo}`) : null;

  // loading / checking
  if (restLoading || geoState === 'checking') {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2" style={{ borderColor: brand }}>
          {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: brand }} />}
        </div>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand }} />
        <p className="text-[#71717a] text-sm">Verifying your location...</p>
      </div>
    );
  }

  // ── Invalid QR Code ───────────────────────────────────────────────────────
  if (qrError) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Invalid QR Code</h1>
        <p className="text-[#71717a]">This link is invalid or has expired. Please scan the physical QR code on your table to access the menu.</p>
      </div>
    );
  }

  // 'skipped' = geo unavailable/denied — allow menu access but show soft warning
  // 'denied' = user is confirmed outside restaurant
  if (geoState === 'denied') {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MapPin size={48} className="text-red-400" />
        <h1 className="text-2xl font-bold text-white">Outside Restaurant</h1>
        <p className="text-[#71717a]">You must be inside {restaurant?.name} to access the menu.</p>
      </div>
    );
  }

  // ── Table not active — show self-activation screen ────────────────────────
  if (tableStatus && !['active','occupied'].includes(tableStatus.status)) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
        {/* Restaurant branding */}
        {logoUrl && (
          <motion.img initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
            src={logoUrl} alt={restaurant.name}
            className="w-24 h-24 rounded-3xl object-cover mb-4 shadow-2xl"
            style={{border:`3px solid ${brand}`}} />
        )}
        <motion.h1 initial={{y:10,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}}
          className="text-2xl font-bold text-white font-display mb-1">{restaurant?.name}</motion.h1>
        <p className="text-[#71717a] text-sm mb-8">Scan · Order · Enjoy</p>

        <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}}
          className="card p-6 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{background:`${brand}22`}}>🪑</div>
          <h2 className="font-bold text-white text-lg mb-4">Table {tableNumber}</h2>
          
          <form onSubmit={handleSelfActivate} className="space-y-3 mb-5 text-left">
            <div>
              <label className="text-xs text-[#71717a] font-semibold mb-1 block">Your Name</label>
              <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                style={{ focusBorderColor: brand }} />
            </div>
            <div>
              <label className="text-xs text-[#71717a] font-semibold mb-1 block">WhatsApp Mobile Number</label>
              <input type="tel" required value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                placeholder="10-digit number" pattern="[0-9]{10}"
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none" />
              <p className="text-[10px] text-[#555] mt-1">We'll send your digital bill here</p>
            </div>
            
            <motion.button whileTap={{scale:0.97}} type="submit" disabled={activating}
              className="w-full py-3.5 mt-2 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
              style={{background:`linear-gradient(135deg, ${brand}, ${brand}cc)`}}>
              {activating
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Activating...</>
                : '🍽️ Start Ordering'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">
      {/* Header with restaurant branding */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${brand}22, ${brand}08)`, borderBottom: `1px solid ${brand}33` }}>
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={restaurant.name} className="w-16 h-16 rounded-2xl object-cover border-2 shrink-0" style={{ borderColor: brand }} />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${brand}33` }}>🍽️</div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-display truncate">{restaurant?.name}</h1>
            <p className="text-xs text-[#71717a] flex items-center gap-2">
              <span className="flex items-center gap-1"><Clock size={10} /> {restaurant?.opening_hours || 'Open Now'}</span>
              {restaurant?.phone && <span className="flex items-center gap-1"><Phone size={10} /> {restaurant.phone}</span>}
            </p>
            <p className="text-xs mt-1 font-medium" style={{ color: brand }}>Table {tableNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            {session?._id && (
              <button onClick={() => router.push(`/${params.slug}/bill?session=${session._id}&table=${tableNumber}`)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: `${brand}44`, color: brand }}>
                <Receipt size={12} /> Orders
              </button>
            )}
            <div className="flex items-center gap-1 text-xs" style={{ color: connected ? '#22c55e' : '#71717a' }}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[var(--brand-color)]"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-2xl mx-auto px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="whitespace-nowrap text-xs font-semibold px-4 py-2 rounded-xl transition-all shrink-0"
              style={activeCategory === cat
                ? { background: brand, color: '#fff' }
                : { background: '#1a1a1a', color: '#a1a1aa', border: '1px solid #2a2a2a' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#555]">
            <p>No items found</p>
          </div>
        )}
        {filtered.map(item => {
          const qty = cart.find(c => c.menu_item_id === item._id)?.quantity || 0;
          const imgUrl = item.image ? (item.image.startsWith('http') ? item.image : `${BACKEND_URL}${item.image}`) : null;
          return (
            <motion.div key={item._id} layout
              className="card overflow-hidden flex gap-0">
              {/* Item Image */}
              <div className="w-28 h-28 shrink-0 overflow-hidden">
                {imgUrl ? <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} /> : (
                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-3xl">🍽️</div>
                )}
              </div>

              {/* Item Info */}
              <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-start gap-1 mb-0.5">
                    {item.is_veg !== undefined && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border text-[10px] shrink-0 ${item.is_veg ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
                        {item.is_veg ? '●' : '●'}
                      </span>
                    )}
                    <p className="font-semibold text-white text-sm leading-tight">{item.name}</p>
                  </div>
                  {item.description && <p className="text-[10px] text-[#71717a] line-clamp-2 mt-0.5">{item.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {item.is_bestseller && <span className="text-[10px] text-yellow-400 flex items-center gap-0.5"><Star size={10} /> Best</span>}
                    {item.is_spicy && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><Flame size={10} /> Spicy</span>}
                    {item.is_veg && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Leaf size={10} /> Veg</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-white text-base">₹{item.price}</span>
                  {qty === 0 ? (
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => addItem({ menu_item_id: item._id, name: item.name, price: item.price, quantity: 1 })}
                      className="text-xs font-bold px-4 py-1.5 rounded-xl text-white transition-all"
                      style={{ background: brand }}>
                      ADD
                    </motion.button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeItem(item._id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: `${brand}33` }}>
                        <Minus size={14} style={{ color: brand }} />
                      </button>
                      <span className="font-bold text-white w-5 text-center">{qty}</span>
                      <button onClick={() => addItem({ menu_item_id: item._id, name: item.name, price: item.price, quantity: 1 })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: brand }}>
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating Action Bars */}
      {cartCount > 0 ? (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 z-40">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => router.push(`/${params.slug}/cart?table=${tableNumber}&session=${session?._id || ''}`)}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-between px-5 text-lg shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
              <span className="bg-white/20 px-2.5 py-1 rounded-lg text-sm">{cartCount} items</span>
              <span>View Cart</span>
              <span className="font-bold">₹{subtotal()}</span>
            </button>
          </div>
        </motion.div>
      ) : (
        session?._id && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 z-40">
            <div className="max-w-2xl mx-auto">
              <button onClick={() => router.push(`/${params.slug}/bill?session=${session._id}&table=${tableNumber}`)}
                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-between px-5 text-sm shadow-2xl bg-[#111] border border-[#2a2a2a] hover:bg-[#1a1a1a] transition-all">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-semibold text-[#a1a1aa]">Table Session Active</span>
                </span>
                <span className="flex items-center gap-1 font-bold" style={{ color: brand }}>
                  📋 View Active Orders & Bill →
                </span>
              </button>
            </div>
          </motion.div>
        )
      )}
    </div>
  );
}
