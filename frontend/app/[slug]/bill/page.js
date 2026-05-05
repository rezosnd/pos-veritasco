'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, Phone, MessageCircle, QrCode, Printer, RefreshCw, Clock, ChefHat, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { billingApi, sessionApi, orderApi } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { connectSocket } from '@/lib/socket';
import useAuthStore from '@/store/authStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STATUS_COLOR = {
  pending: '#f59e0b', accepted: '#f97316', preparing: '#3b82f6',
  ready: '#22c55e', served: '#6b7280', cancelled: '#ef4444',
};

export default function BillPage({ params }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const tableNumber = searchParams.get('table');
  const { restaurant } = useRestaurant();
  const { user } = useAuthStore(); // Check if viewing as staff

  const [bill, setBill] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'bill'

  const brand = restaurant?.theme_color || '#e85d04';
  const logoUrl = restaurant?.logo
    ? (restaurant.logo.startsWith('http') ? restaurant.logo : `${BACKEND_URL}${restaurant.logo}`)
    : null;

  const loadBill = async () => {
    if (!sessionId) return;
    try {
      const [billRes, ordersRes] = await Promise.all([
        billingApi.get(sessionId),
        orderApi.getBySession(sessionId),
      ]);
      setBill(billRes.data);
      setOrders(ordersRes.data.orders || []);
      if (['billed', 'paid'].includes(billRes.data.session?.status)) setBillRequested(true);
      if (billRes.data.session?.payment_status === 'paid') setPaid(true);
    } catch (e) {
      toast.error('Could not load bill');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBill(); }, [sessionId]);

  // Socket: listen for bill-finalized event
  useEffect(() => {
    if (!sessionId) return;
    const s = connectSocket();
    s.emit('join-session', { session_id: sessionId });
    s.on('bill-finalized', () => { setBillRequested(true); loadBill(); toast.success('Your bill is ready!'); });
    s.on('order-placed', () => loadBill());
    s.on('order-updated', () => loadBill());
    s.on('session-closed', () => {
      toast.success('Session has ended. Redirecting...', { duration: 4000 });
      useCartStore.getState().clearCart();
      setTimeout(() => {
        window.location.href = 'https://veritasco.tech';
      }, 3000);
    });
    return () => { 
      s.off('bill-finalized'); 
      s.off('order-placed'); 
      s.off('order-updated'); 
      s.off('session-closed');
    };
  }, [sessionId]);

  const requestBill = async () => {
    if (!sessionId) return;
    setRequesting(true);
    try {
      await sessionApi.requestBill(sessionId);
      setBillRequested(true);
      toast.success('Bill requested! Your waiter is on their way.');
    } catch (e) { toast.error(e.message); }
    finally { setRequesting(false); }
  };

  const cancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await orderApi.cancel(orderId, 'Cancelled by staff');
      toast.success('Order cancelled');
      loadBill();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin" style={{ color: brand }} />
    </div>
  );

  const b = bill?.bill;
  const activeOrders = orders.filter(o => !o.is_cancelled);

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1f1f1f] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />}
          <div className="flex-1">
            <h1 className="font-bold text-white">{restaurant?.name}</h1>
            <p className="text-xs text-[#71717a]">Table {tableNumber} · {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={loadBill} className="text-[#555] hover:text-white p-1"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 mb-4 bg-[#111] p-1 rounded-xl">
          {[{ id: 'orders', label: 'My Orders' }, { id: 'bill', label: 'Bill' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.id ? 'text-white' : 'text-[#71717a]'}`}
              style={activeTab === t.id ? { background: brand } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 && (
              <div className="text-center py-12 text-[#555]">
                <ChefHat size={40} className="mx-auto mb-3 opacity-30" />
                <p>No orders yet</p>
              </div>
            )}
            {orders.map(order => (
              <div key={order._id} className={`card p-4 ${order.is_cancelled ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold text-white text-sm">{order.order_number}</p>
                    <p className="text-xs text-[#555]">{new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize`}
                      style={{ background: `${STATUS_COLOR[order.status]}20`, color: STATUS_COLOR[order.status] }}>
                      {order.status}
                    </span>
                    {/* Waiter Cancel Button */}
                    {user && !order.is_cancelled && order.status !== 'served' && (
                      <button onClick={() => cancelOrder(order._id)} className="text-red-400 hover:text-red-300 bg-red-400/10 p-1.5 rounded-lg">
                        <XCircle size={14}/>
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[#d4d4d8]">{item.name} <span className="text-[#555]">×{item.quantity}</span></span>
                      <span className="text-white font-medium">₹{item.subtotal}</span>
                    </div>
                  ))}
                </div>
                {order.kitchen_notes && (
                  <p className="text-xs text-yellow-400 bg-yellow-400/10 rounded-lg p-2 mt-2">📝 {order.kitchen_notes}</p>
                )}
                <div className="border-t border-[#1f1f1f] mt-3 pt-2 flex justify-between">
                  <span className="text-xs text-[#555]">Order total</span>
                  <span className="font-bold text-white">₹{order.subtotal}</span>
                </div>
              </div>
            ))}

            {/* Order more button */}
            <button onClick={() => window.location.href = `/${restaurant?.slug}/menu?table=${tableNumber}`}
              className="w-full py-3.5 rounded-xl border border-dashed text-sm font-semibold transition-all"
              style={{ borderColor: `${brand}44`, color: brand }}>
              + Order More Items
            </button>
          </div>
        )}

        {/* BILL TAB */}
        {activeTab === 'bill' && (
          <div className="space-y-4">
            {/* Bill Summary */}
            <div className="card p-5" id="bill-print-area">
              {/* Restaurant header for print */}
              <div className="text-center mb-4 pb-4 border-b border-[#1f1f1f]">
                {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mx-auto mb-2" />}
                <p className="font-bold text-white text-lg">{restaurant?.name}</p>
                {restaurant?.address?.street && <p className="text-xs text-[#555]">{restaurant.address.street}</p>}
                {restaurant?.phone && <p className="text-xs text-[#555]">📞 {restaurant.phone}</p>}
                <p className="text-xs text-[#555] mt-1">Table {tableNumber} · {new Date().toLocaleString()}</p>
              </div>

              {/* Consolidated items */}
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">Items</p>
                {(bill?.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[#d4d4d8] flex-1">{item.name}</span>
                    <span className="text-[#555] w-10 text-center">×{item.quantity}</span>
                    <span className="text-white font-medium w-16 text-right">₹{item.subtotal}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#71717a]">Subtotal</span>
                  <span className="text-white">₹{b?.subtotal || 0}</span>
                </div>
                {(b?.gst || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#71717a]">GST ({b?.gstPercent}%)</span>
                    <span className="text-white">₹{b?.gst || 0}</span>
                  </div>
                )}
                {(b?.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Discount</span>
                    <span className="text-green-400">-₹{b?.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-[#1f1f1f] pt-2">
                  <span className="text-white">Total</span>
                  <span style={{ color: brand }}>₹{b?.total || 0}</span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            {user ? (
              <>
                {!paid && (
                  <div className="card p-5 space-y-3">
                    <p className="text-sm font-semibold text-white mb-3">Pay Now</p>

                    {/* UPI QR Code */}
                    {bill?.upiUrl && (
                      <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center mb-4 border-2" style={{ borderColor: brand }}>
                        <p className="text-black font-bold text-xs mb-2 uppercase tracking-wide">Scan to Pay</p>
                        <QRCodeSVG value={bill.upiUrl} size={150} level="M" />
                        <p className="text-[#555] text-xs mt-2 font-medium">Any UPI App</p>
                      </div>
                    )}

                    {/* UPI Button */}
                    {bill?.upiUrl && (
                      <a href={bill.upiUrl}
                        className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
                        📱 Pay via UPI App — ₹{b?.total}
                      </a>
                    )}

                    {/* WhatsApp */}
                    {bill?.waUrl && (
                      <a href={bill.waUrl} target="_blank" rel="noreferrer"
                        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white">
                        <MessageCircle size={16} /> Send Bill on WhatsApp
                      </a>
                    )}

                    {/* Print */}
                    <button onClick={() => window.print()}
                      className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-[#a1a1aa] border border-[#2a2a2a] hover:border-[#3a3a3a]">
                      <Printer size={16} /> Print Bill
                    </button>
                  </div>
                )}

                {paid && (
                  <div className="card p-5 text-center">
                    <CheckCircle size={40} className="text-green-400 mx-auto mb-2" />
                    <p className="font-bold text-green-400 text-lg">Payment Done!</p>
                    <p className="text-[#555] text-sm">Thank you for dining with us 🙏</p>
                  </div>
                )}
              </>
            ) : (
              <div className="card p-6 text-center border border-dashed border-[#2a2a2a]">
                <CheckCircle size={32} className="mx-auto mb-2" style={{ color: brand }} />
                <p className="font-semibold text-white text-sm">Review Your Bill Details Above</p>
                <p className="text-[#71717a] text-xs mt-1 max-w-sm mx-auto">
                  To pay or settle your bill, please inform your waiter. They will present the payment QR code and settle the order on their terminal.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f0f0f]/95 backdrop-blur-sm border-t border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto">
          {user ? (
            <div className="flex gap-3">
              <button onClick={() => window.location.href = `/${restaurant?.slug}/menu?table=${tableNumber}`}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm border transition-all"
                style={{ borderColor: `${brand}44`, color: brand }}>
                + Order More
              </button>
              {!billRequested ? (
                <motion.button whileTap={{ scale: 0.97 }} onClick={requestBill} disabled={requesting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
                  {requesting ? <Loader2 size={14} className="animate-spin" /> : '🧾'} Request Bill
                </motion.button>
              ) : (
                <div className="flex-1 py-3.5 rounded-xl font-bold text-center text-sm bg-green-500/10 border border-green-500/30 text-green-400">
                  ✅ Bill Requested
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => window.location.href = `/${restaurant?.slug}/menu?table=${tableNumber}`}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm text-center"
              style={{ background: brand }}>
              + Order More Items
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
