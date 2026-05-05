'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, MessageCircle, Printer, CreditCard, CheckCircle2, Clock, ChefHat, Loader2, UtensilsCrossed, Plus } from 'lucide-react';
import { billingApi, restaurantApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import UpiQrModal from '@/components/billing/UpiQrModal';
import ThermalPrint from '@/components/billing/ThermalPrint';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  accepted:  { label: 'Accepted',  icon: CheckCircle2, color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  preparing: { label: 'Preparing', icon: ChefHat,      color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ready:     { label: 'Ready',     icon: CheckCircle2, color: 'text-blue-400',  bg: 'bg-blue-400/10' },
  served:    { label: 'Served',    icon: CheckCircle2, color: 'text-blue-500',  bg: 'bg-blue-500/10' },
  cancelled: { label: 'Cancelled', icon: RefreshCw,    color: 'text-slate-400',    bg: 'bg-slate-400/10' },
};

import { Suspense } from 'react';

function BillPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rid = searchParams.get('rid');
  const table = searchParams.get('table');
  const sid = searchParams.get('sid');

  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpi, setShowUpi] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const loadBill = useCallback(async () => {
    if (!sid) return;
    try {
      const res = await billingApi.get(sid);
      setBillData(res.data);
    } catch (err) {
      toast.error('Failed to load bill');
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => { loadBill(); }, [loadBill]);

  // Socket: live order status updates
  useEffect(() => {
    if (!sid) return;
    const socket = connectSocket();
    socket.on('order-updated', () => loadBill());
    socket.on('bill-finalized', () => { loadBill(); toast.success('Bill has been finalized!'); });
    socket.on('payment-confirmed', () => { loadBill(); toast.success('Payment confirmed! Thank you!'); });
    return () => {
      socket.off('order-updated');
      socket.off('bill-finalized');
      socket.off('payment-confirmed');
    };
  }, [sid, loadBill]);

  const handleWhatsApp = () => {
    if (billData?.waUrl) window.open(billData.waUrl, '_blank');
  };

  const handleRequestBill = () => {
    const socket = connectSocket();
    socket.emit('request-bill', { session_id: sid });
    toast.success('Bill requested! Your waiter will bring it shortly.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#a1a1aa]" size={32} />
      </div>
    );
  }

  const { session, restaurant, orders = [], items = [], bill } = billData || {};
  const brand = restaurant?.theme_color || '#e85d04';
  const isPaid = session?.payment_status === 'paid';

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-[#1f1f1f] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/menu?rid=${rid}&table=${table}&sid=${sid}`)} className="text-[#a1a1aa] hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold font-display">Your Bill</h1>
          <button onClick={loadBill} className="ml-auto text-[#a1a1aa] hover:text-white">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Restaurant Header */}
        <div className="text-center py-4">
          {restaurant?.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: `linear-gradient(135deg, ${brand}, ${brand}99)` }}>
              <UtensilsCrossed size={24} className="text-white" />
            </div>
          )}
          <h2 className="font-bold text-white text-xl font-display">{restaurant?.name}</h2>
          <p className="text-[#71717a] text-sm">Table {table}</p>
          {isPaid && (
            <div className="mt-2 inline-flex items-center gap-1 text-blue-400 text-sm bg-blue-400/10 px-3 py-1 rounded-full">
              <CheckCircle2 size={14} /> Payment Confirmed
            </div>
          )}
        </div>

        {/* Active Orders */}
        {orders.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-white mb-3">Order Status</h3>
            <div className="space-y-2">
              {orders.filter(o => !o.is_cancelled).map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <div key={order._id} className="flex items-center justify-between py-2 border-b border-[#1f1f1f] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{order.order_number}</p>
                      <p className="text-xs text-[#71717a]">{order.items?.length} item(s)</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
                      <Icon size={12} /> {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Add more button */}
            <button
              onClick={() => router.push(`/menu?rid=${rid}&table=${table}&sid=${sid}`)}
              className="mt-3 flex items-center gap-2 text-sm font-medium"
              style={{ color: brand }}
            >
              <Plus size={16} /> Add more items
            </button>
          </div>
        )}

        {/* Bill Items */}
        {items.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-white mb-3">Items Ordered</h3>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm border ${item.type === 'veg' ? 'border-blue-500' : 'border-slate-500'} flex items-center justify-center`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'veg' ? 'bg-blue-500' : 'bg-slate-500'}`} />
                    </span>
                    <span className="text-[#d4d4d8]">{item.name} × {item.quantity}</span>
                  </div>
                  <span className="text-white font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="divider pt-2" />
              <div className="flex justify-between text-sm text-[#a1a1aa]">
                <span>Subtotal</span><span>₹{bill?.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-[#a1a1aa]">
                <span>GST ({bill?.gstPercent}%)</span><span>₹{bill?.gst?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-white pt-1">
                <span>Total</span>
                <span style={{ color: brand }}>₹{bill?.total?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isPaid && (
          <div className="space-y-3">
            <button
              onClick={handleRequestBill}
              className="btn-outline w-flex w-full flex items-center justify-center gap-2"
              style={{ borderColor: brand, color: brand }}
            >
              Request Bill
            </button>
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 px-6 rounded-xl hover:bg-[#20b958] transition-all"
            >
              <MessageCircle size={18} /> Send Bill to WhatsApp
            </button>
            {billData?.upiUrl && (
              <button
                onClick={() => setShowUpi(true)}
                className="btn-brand w-full flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}
              >
                <CreditCard size={18} /> Pay via UPI
              </button>
            )}
            <button
              onClick={() => setShowPrint(true)}
              className="w-full flex items-center justify-center gap-2 text-[#a1a1aa] border border-[#333] py-3 rounded-xl hover:bg-[#1a1a1a] transition-all"
            >
              <Printer size={18} /> Print Receipt
            </button>
          </div>
        )}
      </div>

      {/* UPI QR Modal */}
      {showUpi && billData?.upiUrl && (
        <UpiQrModal
          upiUrl={billData.upiUrl}
          amount={bill?.total}
          restaurantName={restaurant?.name}
          brandColor={brand}
          onClose={() => setShowUpi(false)}
        />
      )}

      {/* Thermal Print */}
      {showPrint && (
        <ThermalPrint
          restaurant={restaurant}
          items={items}
          bill={bill}
          tableNumber={table}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

export default function BillPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#a1a1aa]" size={32} />
      </div>
    }>
      <BillPageContent />
    </Suspense>
  );
}
