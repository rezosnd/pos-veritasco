'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, Phone, MessageCircle, QrCode, Printer, RefreshCw, Clock, ChefHat, XCircle, ArrowLeft, Plus, Receipt, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { billingApi, sessionApi, orderApi, paymentApi, getBackendUrl, getFullUrl } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { connectSocket } from '@/lib/socket';
import useAuthStore from '@/store/authStore';

const BACKEND_URL = getBackendUrl();

const STATUS_COLOR = {
  pending: '#f59e0b', accepted: '#f97316', preparing: '#3b82f6',
  ready: 'var(--brand-500)', served: '#6b7280', cancelled: '#64748b',
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
  const [confirming, setConfirming] = useState(false);

  const handleConfirmPayment = async (method) => {
    if (!sessionId) return;
    if (!confirm(`Settle bill via ${method.toUpperCase()}?`)) return;
    setConfirming(true);
    try {
      await paymentApi.confirm(sessionId, {
        payment_method: method,
        payment_reference: method === 'upi' ? 'Staff Confirmed' : 'Cash Received'
      });
      toast.success('Payment settled and table closed successfully!');
      loadBill();
      setTimeout(() => {
        window.location.href = `/${restaurant?.slug}/waiter`;
      }, 1500);
    } catch (err) {
      toast.error(err.message || 'Failed to settle payment');
    } finally {
      setConfirming(false);
    }
  };

  const brand = restaurant?.theme_color || 'var(--brand-600)';
  const logoUrl = getFullUrl(restaurant?.logo);

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
    } finally { 
      setLoading(false);
      // Auto-print if requested
      if (searchParams.get('print') === 'true') {
        setTimeout(() => window.print(), 500);
      }
    }
  };

  useEffect(() => { loadBill(); }, [sessionId]);

  // Socket
  useEffect(() => {
    if (!sessionId) return;
    const s = connectSocket();
    s.emit('join-session', { session_id: sessionId });
    s.on('bill-finalized', () => { setBillRequested(true); loadBill(); toast.success('Your bill is ready!'); });
    s.on('order-placed', () => loadBill());
    s.on('order-updated', () => loadBill());
    s.on('session-closed', () => {
      const isStaff = !!useAuthStore.getState().user;
      if (isStaff) {
        toast.success('Table closed.', { duration: 2000 });
        setTimeout(() => { window.location.href = `/${restaurant?.slug}/waiter`; }, 1500);
      } else {
        toast.success('Session has ended. Redirecting...', { duration: 4000 });
        import('@/store/cartStore').then(mod => mod.default.getState().clearCart());
        setTimeout(() => { window.location.href = 'https://veritasco.tech'; }, 3000);
      }
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

  const shareBill = async (isPhoto = true) => {
    if (!bill || !restaurant) return;
    const b = bill.bill;
    const session = bill.session;
    const items = (b.items || []).map(i => `• ${i.name} x${i.quantity}`).join('\n');
    const text = `*${restaurant.name}*\nTable: ${tableNumber}\n\n*Order Summary:*\n${items}\n\n*Subtotal:* ₹${b.subtotal}\n` +
      (b.gst > 0 ? `*GST:* ₹${b.gst}\n` : '') +
      `*Total to Pay:* ₹${b.total}\n\nThank you for dining with us! 🍽️`;

    const customerPhone = session?.customer_phone ? session.customer_phone.replace(/\D/g, '') : '';
    const targetPhone = customerPhone.length === 10 ? `91${customerPhone}` : customerPhone;
    const waBaseUrl = targetPhone ? `https://wa.me/${targetPhone}` : `https://wa.me/`;

    if (!isPhoto) {
      window.open(`${waBaseUrl}?text=${encodeURIComponent(text)}`, '_blank');
      return;
    }

    const el = document.getElementById('bill-print-area');
    if (el) {
      try {
        toast.loading('Generating bill photo...', { id: 'sharing' });
        const dataUrl = await toPng(el, { backgroundColor: '#fff', pixelRatio: 2 });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `bill-${tableNumber}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${restaurant.name} Bill`,
            text: text,
            files: [file],
          });
          toast.success('Shared successfully!', { id: 'sharing' });
        } else {
          window.open(`${waBaseUrl}?text=${encodeURIComponent(text)}`, '_blank');
          toast.success('Opening WhatsApp...', { id: 'sharing' });
        }
      } catch (err) {
        window.open(`${waBaseUrl}?text=${encodeURIComponent(text)}`, '_blank');
        toast.error('Could not generate image, sharing text instead', { id: 'sharing' });
      }
    } else {
      window.open(`${waBaseUrl}?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <Loader2 size={32} className="animate-spin mb-4" style={{ color: brand }} />
      <p className="text-gray-500 font-medium">Loading your orders...</p>
    </div>
  );

  const b = bill?.bill;
  const activeOrders = orders.filter(o => !o.is_cancelled);

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-32 font-sans">
      
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="text-gray-900 p-1 active:scale-90 transition-transform">
            <ArrowLeft size={22} />
          </button>
          {logoUrl && <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-100 shadow-sm" />}
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{restaurant?.name}</h1>
            <p className="text-[11px] font-medium text-gray-500">Table {tableNumber} • Dining in</p>
          </div>
        </div>
        <button onClick={loadBill} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white shadow-sm mb-3">
        <div className="max-w-2xl mx-auto px-4 flex">
          {[{ id: 'orders', label: `My Orders (${activeOrders.length})` }, { id: 'bill', label: 'Bill Details' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex-1 py-3.5 text-sm font-bold text-center relative transition-colors"
              style={{ color: activeTab === t.id ? brand : '#6b7280' }}>
              {t.label}
              {activeTab === t.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: brand }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <ChefHat size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-gray-700 mb-1">No orders yet</p>
                <p className="text-sm text-gray-400">Start adding dishes from the menu</p>
              </div>
            )}
            
            {orders.map(order => (
              <div key={order._id} className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${order.is_cancelled ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-sm">Order #{order.order_number.slice(-4)}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide"
                        style={{ background: `${STATUS_COLOR[order.status]}15`, color: STATUS_COLOR[order.status] }}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock size={10} /> {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  {/* Waiter Cancel Button */}
                  {user && !order.is_cancelled && order.status !== 'served' && (
                    <button onClick={() => cancelOrder(order._id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <XCircle size={16}/>
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start text-sm">
                      <div className="flex gap-2 text-gray-800 font-medium">
                        <span className="w-4 h-4 rounded border border-gray-200 flex items-center justify-center text-[10px] text-gray-500 bg-gray-50">{item.quantity}</span>
                        <span>x {item.name}</span>
                      </div>
                      <span className="font-semibold text-gray-900">₹{item.subtotal}</span>
                    </div>
                  ))}
                </div>
                
                {order.kitchen_notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100 flex items-start gap-1.5">
                    <span className="opacity-50">📝</span> {order.kitchen_notes}
                  </p>
                )}
                
                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Total</span>
                  <span className="font-bold text-gray-900 text-[15px]">₹{order.subtotal}</span>
                </div>
              </div>
            ))}

            {/* Order more button */}
            {!paid && (
              <button onClick={() => window.location.href = `/${restaurant?.slug}/menu?table=${tableNumber}`}
                className="w-full bg-white py-4 rounded-xl shadow-sm border border-gray-200 font-bold text-[15px] flex items-center justify-center gap-2 active:bg-gray-50 transition-colors"
                style={{ color: brand }}>
                <Plus size={18} /> Add More Items
              </button>
            )}
          </div>
        )}

        {/* ── BILL TAB ── */}
        {activeTab === 'bill' && (() => {
          return (
            <div className="space-y-4">
              {/* Zomato Style Bill Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative" id="bill-print-area">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: brand }} />
                
                <div className="p-5 border-b border-dashed border-gray-200 text-center bg-gray-50/50">
                  {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover mx-auto mb-2 border border-gray-200 shadow-sm" />}
                  <h2 className="font-bold text-gray-900 text-lg uppercase tracking-tight">{restaurant?.name}</h2>
                  <p className="text-xs text-gray-500 font-medium mt-1">Table {tableNumber}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleString()}</p>
                </div>

                <div className="p-5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Order Items</p>
                  <div className="space-y-2.5 mb-5">
                    {(b?.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-sm text-gray-800">
                        <span className="font-semibold flex-1 pr-2 truncate">{item.name}</span>
                        <span className="text-gray-400 w-8 text-center font-bold">x{item.quantity}</span>
                        <span className="font-bold w-16 text-right">₹{item.subtotal}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>Item Total</span>
                      <span className="text-gray-900 font-semibold">₹{b?.subtotal || 0}</span>
                    </div>
                    {(b?.gst || 0) > 0 && (
                      <div className="flex justify-between text-gray-600 font-medium">
                        <span>Taxes & GST ({b?.gstPercent}%)</span>
                        <span className="text-gray-900 font-semibold">₹{b?.gst || 0}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-dashed border-gray-200 pt-4 mt-2">
                      <span className="font-bold text-gray-900 text-base uppercase">To Pay</span>
                      <span className="text-xl font-black text-gray-900">₹{b?.total || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Controls (Only visible to authenticated staff) */}
              {user && !paid && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
                  <p className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Staff Actions</p>
                  
                  {bill?.upiUrl && (
                    <div className="bg-gray-50 p-4 rounded-xl flex flex-col items-center justify-center mb-4 border border-gray-200">
                      <p className="text-gray-900 font-bold text-xs mb-2 uppercase tracking-wide">Scan to Pay</p>
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <QRCodeSVG value={bill.upiUrl} size={150} level="M" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button onClick={() => handleConfirmPayment('cash')} disabled={confirming}
                      className="py-3 rounded-xl font-bold text-[13px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                      💵 Settle Cash
                    </button>
                    <button onClick={() => handleConfirmPayment('upi')} disabled={confirming}
                      className="py-3 rounded-xl font-bold text-[13px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                      📱 Settle UPI
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button onClick={() => window.print()} 
                      className="py-3 rounded-xl font-bold text-[13px] border-2 border-gray-200 hover:bg-gray-50 text-gray-800 flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                      <Printer size={16} /> Print Bill
                    </button>
                    <button onClick={() => shareBill(false)}
                      className="py-3 rounded-xl font-bold text-[13px] bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm flex items-center justify-center gap-1.5 transition-colors">
                      <MessageCircle size={16} className="text-blue-600" /> Send Text Bill (Auto)
                    </button>
                    <button onClick={() => shareBill(true)}
                      className="py-3 rounded-xl font-bold text-[13px] text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                      style={{ background: brand }}>
                      <MessageCircle size={16} /> Share Photo Bill (Manual)
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Status Info (For Customer) */}
              {!user && !paid && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500 mb-3 border border-blue-100">
                    <Receipt size={24} />
                  </div>
                  <p className="font-bold text-blue-900 mb-1 text-[15px]">Ready to pay?</p>
                  <p className="text-blue-700/80 text-xs font-medium max-w-[240px] leading-relaxed">
                    Review your bill above. You can request the bill, and your waiter will assist with payment at your table.
                  </p>
                </div>
              )}

              {paid && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center shadow-sm">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500 mb-3 mx-auto border border-blue-100">
                    <CheckCircle size={32} />
                  </div>
                  <p className="font-black text-blue-600 text-lg tracking-tight mb-1">Payment Received!</p>
                  <p className="text-blue-700/80 text-sm font-medium">Thank you for dining with us</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Fixed Bottom Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgb(0,0,0,0.05)] z-40">
        <div className="max-w-2xl mx-auto">
          {user ? (
            <button onClick={() => window.location.href = `/${restaurant?.slug}/waiter`}
              className="w-full py-4 rounded-xl font-bold text-gray-700 text-[15px] bg-white border-2 border-gray-200 hover:bg-gray-50 shadow-sm transition-all flex justify-center items-center gap-2">
              <ArrowLeft size={18} /> Back to Waiter Dashboard
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => window.location.href = `/${restaurant?.slug}/menu?table=${tableNumber}`}
                className="flex-[0.4] py-4 rounded-xl font-bold text-[14px] bg-white border-2 hover:bg-gray-50 shadow-sm transition-all"
                style={{ borderColor: brand, color: brand }}>
                Order More
              </button>
              {!billRequested ? (
                <motion.button whileTap={{ scale: 0.97 }} onClick={requestBill} disabled={requesting}
                  className="flex-[0.6] py-4 rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2 shadow-md"
                  style={{ background: brand, boxShadow: `0 4px 14px ${brand}40` }}>
                  {requesting ? <Loader2 size={16} className="animate-spin" /> : '🧾 Request Bill'}
                </motion.button>
              ) : (
                <div className="flex-[0.6] py-4 rounded-xl font-bold text-center text-[15px] bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Waiter Notified
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
