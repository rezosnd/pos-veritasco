'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Loader2, MessageSquare } from 'lucide-react';
import { orderApi, restaurantApi } from '@/lib/api';
import useCartStore from '@/store/cartStore';

import { Suspense } from 'react';

function CartPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rid = searchParams.get('rid');
  const table = searchParams.get('table');
  const sid = searchParams.get('sid');

  const { cart, addItem, removeItem, updateQuantity, clearCart } = useCartStore();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!rid) return;
    restaurantApi.getPublic(rid).then(r => {
      setRestaurant(r.data.restaurant);
      document.documentElement.style.setProperty('--brand-color', r.data.restaurant.theme_color || '#e85d04');
    }).catch(() => {});
  }, [rid]);

  const gstPercent = restaurant?.gst_percent ?? 5;
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const gst = (subtotal * gstPercent) / 100;
  const total = subtotal + gst;
  const brand = restaurant?.theme_color || '#e85d04';

  const handlePlaceOrder = async () => {
    if (!cart.length) return toast.error('Your cart is empty');
    if (!sid) return toast.error('Session expired. Please scan QR again.');
    setLoading(true);
    try {
      await orderApi.place({
        session_id: sid,
        items: cart.map(i => ({
          menu_item_id: i.menu_item_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          type: i.type,
          image: i.image,
          category: i.category,
          special_instructions: specialNote,
        })),
        placed_by: 'customer',
        kitchen_notes: specialNote,
      });
      clearCart();
      toast.success('🎉 Order placed successfully!');
      router.push(`/bill?rid=${rid}&table=${table}&sid=${sid}`);
    } catch (err) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!cart.length) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#1f1f1f]">
          <button onClick={() => router.back()} className="text-[#a1a1aa] hover:text-white transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold font-display">Your Cart</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <ShoppingBag size={64} className="text-[#333] mb-4" />
          <h2 className="text-xl font-bold text-[#a1a1aa] mb-2">Your cart is empty</h2>
          <p className="text-[#71717a] mb-6">Add some delicious items from the menu</p>
          <button onClick={() => router.back()} className="btn-brand">Browse Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-[#1f1f1f] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#a1a1aa] hover:text-white transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold font-display">Your Cart</h1>
          <span className="ml-auto text-sm text-[#71717a]">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-3 pb-48">
        {/* Cart Items */}
        <AnimatePresence>
          {cart.map((item) => (
            <motion.div
              key={item.menu_item_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              className="card p-4 flex items-center gap-4"
            >
              {item.image && (
                <img src={item.image} alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${item.type === 'veg' ? 'border-blue-500' : 'border-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${item.type === 'veg' ? 'bg-blue-500' : 'bg-slate-500'}`} />
                  </span>
                  <p className="font-medium text-white text-sm leading-tight">{item.name}</p>
                </div>
                <p className="text-[#a1a1aa] text-sm mt-1">₹{item.price} × {item.quantity}</p>
                <p className="font-bold text-sm" style={{ color: brand }}>
                  ₹{(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => removeItem(item.menu_item_id)}
                  className="w-8 h-8 rounded-xl border border-[#333] flex items-center justify-center text-[#a1a1aa] hover:border-slate-400 hover:text-slate-400 transition-all"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                <button
                  onClick={() => addItem({ menu_item_id: item.menu_item_id, name: item.name, price: item.price, type: item.type, image: item.image, category: item.category })}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all"
                  style={{ background: brand }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Special Instructions */}
        <div className="card p-4">
          <button
            className="flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-white transition-colors w-full"
            onClick={() => setShowNote(!showNote)}
          >
            <MessageSquare size={16} />
            Add special instructions (optional)
          </button>
          <AnimatePresence>
            {showNote && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <textarea
                  className="input mt-3 resize-none"
                  rows={3}
                  placeholder="e.g., No spice, extra sauce..."
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bill Summary */}
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-white">Bill Summary</h3>
          <div className="divider" />
          <div className="flex justify-between text-sm text-[#a1a1aa]">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#a1a1aa]">
            <span>GST ({gstPercent}%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="divider" />
          <div className="flex justify-between font-bold text-lg text-white">
            <span>Total</span>
            <span style={{ color: brand }}>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f]/95 backdrop-blur-md border-t border-[#1f1f1f] p-4">
        <div className="max-w-2xl mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePlaceOrder}
            disabled={loading}
            className="btn-brand w-full flex items-center justify-center gap-2 text-base"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Placing Order...</>
            ) : (
              <>Place Order · ₹{total.toFixed(2)}</>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#a1a1aa]" size={32} />
      </div>
    }>
      <CartPageContent />
    </Suspense>
  );
}
