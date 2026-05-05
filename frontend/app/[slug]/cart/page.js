'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Loader2, MessageSquare, Receipt } from 'lucide-react';
import { orderApi, sessionApi } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import useCartStore from '@/store/cartStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

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

  const brand = restaurant?.theme_color || '#e85d04';
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
      let sid = currentSession;
      if (!sid) {
        // Table might have been activated — get session
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
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 p-6">
        {logoUrl && <img src={logoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover" />}
        <ShoppingBag size={48} className="text-[#333]" />
        <p className="text-[#555] text-lg">Your cart is empty</p>
        <button onClick={() => router.push(`/${params.slug}/menu?table=${tableNumber}`)}
          className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ background: brand }}>
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-40">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1f1f1f] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#71717a] hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        {logoUrl && <img src={logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />}
        <div className="flex-1">
          <p className="font-bold text-white text-sm">{restaurant?.name}</p>
          <p className="text-[10px] text-[#71717a]">Table {tableNumber} · {cart.length} items</p>
        </div>
        {sessionId && (
          <button onClick={() => router.push(`/${params.slug}/bill?session=${sessionId}&table=${tableNumber}`)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border"
            style={{ borderColor: `${brand}44`, color: brand }}>
            <Receipt size={13} /> Orders & Bill
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {/* Cart Items */}
        <AnimatePresence>
          {cart.map(item => {
            const imgUrl = item.image ? (item.image.startsWith('http') ? item.image : `${BACKEND_URL}${item.image}`) : null;
            return (
              <motion.div key={item.menu_item_id} layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="card p-4 flex items-center gap-4">
                {imgUrl && <img src={imgUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{item.name}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: brand }}>₹{item.price}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => removeItem(item.menu_item_id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `${brand}22` }}>
                    {item.quantity === 1 ? <Trash2 size={14} style={{ color: brand }} /> : <Minus size={14} style={{ color: brand }} />}
                  </button>
                  <span className="font-bold text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => addItem({ ...item, quantity: 1 })}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: brand }}>
                    <Plus size={14} className="text-white" />
                  </button>
                </div>
                <p className="font-bold text-white w-16 text-right shrink-0">₹{item.price * item.quantity}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Notes */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={14} className="text-[#71717a]" />
            <p className="text-xs font-semibold text-[#71717a]">Special Instructions (optional)</p>
          </div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any allergies, special requests for the kitchen..."
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3 text-sm text-white placeholder-[#555] resize-none focus:outline-none focus:border-[var(--brand-color)] h-20"
          />
        </div>

        {/* Bill Summary */}
        <div className="card p-4 space-y-2">
          <p className="font-semibold text-white text-sm mb-3">Bill Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-[#71717a]">Subtotal</span>
            <span className="text-white">₹{itemTotal}</span>
          </div>
          {gst > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#71717a]">GST ({gst}%)</span>
              <span className="text-white">₹{gstAmt}</span>
            </div>
          )}
          <div className="border-t border-[#2a2a2a] pt-2 flex justify-between font-bold">
            <span className="text-white">Total</span>
            <span className="text-xl" style={{ color: brand }}>₹{grandTotal}</span>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f0f0f]/90 backdrop-blur-sm border-t border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={placeOrder}
            disabled={placing}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-between px-6 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
            <span className="text-sm font-semibold opacity-80">{cart.length} items</span>
            <span>{placing ? <Loader2 size={20} className="animate-spin" /> : 'Place Order 🚀'}</span>
            <span className="font-bold">₹{grandTotal}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
