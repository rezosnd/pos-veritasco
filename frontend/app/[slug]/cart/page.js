'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Loader2, MessageSquare, Receipt, Utensils } from 'lucide-react';
import { orderApi, sessionApi, getBackendUrl } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import useCartStore from '@/store/cartStore';
import { validateLocation } from '@/lib/geo';

const BACKEND_URL = getBackendUrl();

export default function CartPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');
  const sessionId = searchParams.get('session');
  const { restaurant } = useRestaurant();

  const { cart, addItem, removeItem, clearCart, subtotal } = useCartStore();
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [currentSession, setCurrentSession] = useState(sessionId);

  useEffect(() => {
    if (sessionId) setCurrentSession(sessionId);
  }, [sessionId]);

  const brand = restaurant?.theme_color || 'var(--brand-600)';
  const logoUrl = restaurant?.logo
    ? (restaurant.logo.startsWith('http') ? restaurant.logo : `${BACKEND_URL}${restaurant.logo}`)
    : null;

  const gst = restaurant?.gst_percent || 0;
  const itemTotal = subtotal();
  const gstAmt = Math.round(itemTotal * gst / 100);
  const grandTotal = itemTotal + gstAmt;

  const placeOrder = async () => {
    if (!cart.length) return toast.error('Cart is empty');
    if (!restaurant?._id) return toast.error('Restaurant not loaded');

    setPlacing(true);
    try {
      const bypassGeo = process.env.NEXT_PUBLIC_BYPASS_GEO === 'true';
      if (!bypassGeo && restaurant.latitude && restaurant.longitude) {
        const geo = await validateLocation(restaurant.latitude, restaurant.longitude, restaurant.geo_radius_meters || 100);
        if (geo.error) throw new Error(`Location verification required: ${geo.error}`);
        if (!geo.allowed) throw new Error(`You are currently too far (${geo.distance}m) from ${restaurant.name}. Please be inside to order.`);
      }

      let sid = currentSession;
      if (!sid) {
        try {
          const sRes = await sessionApi.getByTable(restaurant._id, tableNumber);
          sid = sRes.data.session._id;
          setCurrentSession(sid);
        } catch (err) {
          throw new Error('Table is not active. Please scan the QR code to start ordering.');
        }
      }
      if (!sid) throw new Error('Session could not be established.');

      await orderApi.place({
        restaurant_id: restaurant._id,
        session_id: sid,
        table_number: tableNumber,
        items: cart.map(c => ({ menu_item_id: c.menu_item_id, name: c.name, price: c.price, quantity: c.quantity })),
        kitchen_notes: notes,
      });
      clearCart();
      toast.success('🎉 Order sent to kitchen!');
      router.push(`/${params.slug}/bill?session=${sid}&table=${tableNumber}`);
    } catch (e) {
      toast.error(e.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (!cart.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 p-6 text-center">
        {logoUrl ? <img src={logoUrl} alt="" className="w-20 h-20 rounded-full object-cover shadow-sm border border-gray-100" /> : <Utensils size={40} className="text-gray-300" />}
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
          <ShoppingBag size={32} className="text-gray-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
          <p className="text-gray-500 text-sm mt-1">Looks like you haven't added anything yet</p>
        </div>
        <button onClick={() => router.push(`/${params.slug}/menu?table=${tableNumber}`)}
          className="px-8 py-3.5 mt-2 rounded-xl text-white font-bold text-[15px] shadow-md active:scale-95 transition-all"
          style={{ background: brand }}>
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-40 font-sans">
      
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
        <button onClick={() => router.back()} className="text-gray-900 p-1 active:scale-90 transition-transform">
          <ArrowLeft size={22} />
        </button>
        {logoUrl && <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-100 shadow-sm" />}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-[15px] leading-tight truncate">{restaurant?.name}</p>
          <p className="text-[11px] font-medium text-gray-500">Table {tableNumber} • Dining in</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        
        {/* ── Cart Items ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Order</span>
            <span className="text-xs font-semibold text-gray-500">{cart.length} items</span>
          </div>
          <div className="divide-y divide-gray-50">
            <AnimatePresence>
              {cart.map(item => {
                const imgUrl = item.image ? (item.image.startsWith('http') ? item.image : `${BACKEND_URL}${item.image}`) : null;
                return (
                  <motion.div key={item.menu_item_id} layout
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="p-4 flex items-start gap-4 bg-white relative overflow-hidden">
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-snug">{item.name}</p>
                      <p className="text-sm font-semibold mt-1 text-gray-700">₹{item.price}</p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="font-bold text-gray-900 text-[15px]">₹{item.price * item.quantity}</div>
                      <div className="flex items-center gap-0 w-[84px] h-[30px] rounded-lg border shadow-sm bg-white overflow-hidden" style={{ borderColor: brand }}>
                        <button onClick={() => removeItem(item.menu_item_id)} className="w-7 h-full flex items-center justify-center bg-gray-50 active:bg-gray-100">
                          {item.quantity === 1 ? <Trash2 size={13} style={{ color: brand }} /> : <Minus size={13} style={{ color: brand }} />}
                        </button>
                        <span className="font-bold text-sm flex-1 text-center" style={{ color: brand }}>{item.quantity}</span>
                        <button onClick={() => addItem({ ...item, quantity: 1 })} className="w-7 h-full flex items-center justify-center bg-gray-50 active:bg-gray-100">
                          <Plus size={13} style={{ color: brand }} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Add more items ── */}
        <button onClick={() => router.back()} className="w-full bg-white rounded-xl py-3.5 border border-gray-200 shadow-sm flex items-center justify-center gap-2 font-bold text-gray-700 active:bg-gray-50 transition-colors">
          <Plus size={18} /> Add more items
        </button>

        {/* ── Notes ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={16} className="text-gray-400" />
            <p className="text-sm font-bold text-gray-800">Cooking Instructions</p>
          </div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Make it spicy, no onions..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-gray-300 focus:bg-white transition-all h-20"
          />
        </div>

        {/* ── Bill Details ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <p className="font-bold text-gray-900 text-[15px] mb-2 border-b border-gray-100 pb-3">Bill Details</p>
          <div className="flex justify-between text-[13px] font-medium text-gray-600">
            <span>Item Total</span>
            <span className="text-gray-900">₹{itemTotal}</span>
          </div>
          {gst > 0 && (
            <div className="flex justify-between text-[13px] font-medium text-gray-600">
              <span>Taxes & GST ({gst}%)</span>
              <span className="text-gray-900">₹{gstAmt}</span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-900">To Pay</span>
            <span className="text-xl font-black text-gray-900">₹{grandTotal}</span>
          </div>
        </div>
      </div>

      {/* ── Place Order Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgb(0,0,0,0.05)] z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col pl-2">
            <span className="font-black text-[19px] text-gray-900 leading-tight">₹{grandTotal}</span>
            <span className="text-[11px] font-bold text-[var(--brand-color)] uppercase tracking-wider">Total</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={placeOrder}
            disabled={placing}
            className="flex-1 py-4 rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 transition-all"
            style={{ background: brand, boxShadow: `0 4px 14px ${brand}40` }}>
            {placing ? <><Loader2 size={18} className="animate-spin" /> Placing...</> : 'Place Order'}
            {!placing && <div className="w-1.5 h-1.5 rounded-full bg-white ml-1 opacity-50" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
