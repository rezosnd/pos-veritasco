'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, LogOut, RefreshCw, Users, X, CheckCircle, XCircle, Clock, ShoppingBag, Wifi, WifiOff } from 'lucide-react';
import { tableApi, sessionApi, billingApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useRestaurant } from '@/lib/restaurantContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import useAuthStore from '@/store/authStore';

// ── Real status values from backend constants ─────────────────────────────────
// inactive | active | occupied | bill_requested
const STATUS_STYLES = {
  inactive:       { bg:'bg-[#1a1a1a]',          text:'text-[#555]',       border:'border-[#2a2a2a]', dot:'bg-[#444]',    label:'Inactive' },
  active:         { bg:'bg-blue-500/10',         text:'text-blue-400',    border:'border-blue-500/30', dot:'bg-blue-400', label:'Active' },
  occupied:       { bg:'bg-orange-500/10',        text:'text-orange-400',   border:'border-orange-500/30', dot:'bg-orange-400', label:'Occupied' },
  bill_requested: { bg:'bg-purple-500/10',        text:'text-purple-400',   border:'border-purple-500/30', dot:'bg-purple-400', label:'Bill Due' },
  // fallback aliases
  available:      { bg:'bg-[#1a1a1a]',           text:'text-[#555]',       border:'border-[#2a2a2a]', dot:'bg-[#444]',    label:'Available' },
  reserved:       { bg:'bg-blue-500/10',          text:'text-blue-400',     border:'border-blue-500/30', dot:'bg-blue-400', label:'Reserved' },
};

const ago = (d) => {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  return m < 1 ? 'just now' : `${m}m ago`;
};

export default function WaiterPage() {
  const router = useRouter();
  const { user, ready } = useAuthGuard(['waiter', 'restaurant_admin', 'super_admin']);
  const { clearAuth } = useAuthStore();
  const { restaurant } = useRestaurant();
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actLoading, setActLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) return;
    try {
      const r = await tableApi.getAll(restaurant._id, {});
      setTables(r.data.tables || []);
    } catch { toast.error('Failed to load tables'); }
    finally { setLoading(false); }
  }, [restaurant]);

  useEffect(() => { 
    load();
    // Only poll if no table is selected (prevents UI jumpiness during table management)
    if (!selected) {
      const interval = setInterval(() => load(), 10000);
      return () => clearInterval(interval);
    }
  }, [load, selected]);

  // Socket real-time updates
  useEffect(() => {
    if (!restaurant) return;
    const s = connectSocket();
    s.emit('subscribe-restaurant', { restaurant_id: restaurant._id });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('table-activated', load);
    s.on('table-deactivated', load);
    s.on('table-status-changed', load);
    s.on('new-order', load);
    return () => {
      s.off('table-activated', load);
      s.off('table-deactivated', load);
      s.off('table-status-changed', load);
      s.off('new-order', load);
    };
  }, [restaurant, load]);

  const selectTable = async (table) => {
    setSelected(table);
    setSession(null);
    setOrders([]);
    if (['active', 'occupied', 'bill_requested'].includes(table.status)) {
      try {
        const r = await sessionApi.getByTable(restaurant._id, table.table_number);
        setSession(r.data.session);
      } catch {}
    }
  };

  // ── Waiter activates table ─────────────────────────────────────────────────
  const activate = async () => {
    if (!selected?._id) return;
    setActLoading(true);
    try {
      await tableApi.activate(restaurant._id, selected._id, {
        customer_name: customerName,
        customer_phone: customerPhone
      });
      toast.success(`✅ Table ${selected.table_number} activated!`);
      await load();
      setSelected(null);
      setCustomerName('');
      setCustomerPhone('');
    } catch (e) { toast.error(e.message); }
    finally { setActLoading(false); }
  };

  const deactivate = async () => {
    if (!confirm('Close this table? The session will be ended.')) return;
    setActLoading(true);
    try {
      await tableApi.deactivate(restaurant._id, selected._id);
      toast.success('Table closed');
      await load();
      setSelected(null);
    } catch (e) { toast.error(e.message); }
    finally { setActLoading(false); }
  };

  const finalizeBill = async () => {
    if (!session?._id) return toast.error('No active session');
    if (!confirm('Finalize and print bill?')) return;
    try {
      await billingApi.finalize(session._id);
      toast.success('Bill finalized!');
      window.location.href = `/${restaurant.slug}/bill?session=${session._id}&table=${selected.table_number}&print=true`;
    } catch (e) { toast.error(e.message); }
  };

  const brand = restaurant?.theme_color || '#e85d04';
  const sections = [...new Set(tables.map(t => t.section || 'Main'))];

  const activeTables = tables.filter(t => ['active', 'occupied', 'bill_requested'].includes(t.status)).length;
  const inactiveTables = tables.filter(t => t.status === 'inactive').length;

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#71717a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] relative font-sans text-white">
      {/* Background Setup */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: "url('/posshome.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }}></div>
      <div className="fixed inset-0 z-0 bg-black/70 backdrop-blur-sm pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen w-full">
      {/* Header */}
      <header className="bg-[#111]/80 backdrop-blur-md border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: brand }}>
            <Users size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">{restaurant?.name} — Waiter</p>
            <p className="text-[10px] text-[#71717a]">
              {activeTables} active · {inactiveTables} inactive
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${connected ? 'text-blue-400' : 'text-[#555]'}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          </span>
          <button onClick={load} className="text-[#71717a] hover:text-white p-1.5"><RefreshCw size={15} /></button>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-[#71717a] hover:text-slate-400 p-1.5"><LogOut size={15} /></button>
        </div>
      </header>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Status Legend */}
        <div className="flex gap-4 mb-5 flex-wrap">
          {Object.entries(STATUS_STYLES).filter(([k]) => !['available','reserved'].includes(k)).map(([s, st]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${st.dot}`} />
              <span className="text-[#71717a]">{st.label}</span>
            </div>
          ))}
        </div>

        {/* Tables Grid */}
        {sections.map(sec => (
          <div key={sec} className="mb-6">
            {sections.length > 1 && (
              <p className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-3">{sec}</p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {tables.filter(t => (t.section || 'Main') === sec).map(table => {
                const st = STATUS_STYLES[table.status] || STATUS_STYLES.inactive;
                const isSelected = selected?._id === table._id;
                return (
                  <motion.button
                    key={table._id}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => selectTable(table)}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all
                      ${st.bg} ${st.border}
                      ${isSelected ? 'ring-2' : 'hover:brightness-125'}`}
                    style={isSelected ? { ringColor: brand } : {}}
                  >
                    <span className={`font-bold text-sm ${st.text}`}>{table.table_number}</span>
                    <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className={`text-[9px] font-medium ${st.text} opacity-80`}>{st.label}</span>
                    {table.activated_at && ['active','occupied'].includes(table.status) && (
                      <span className="text-[8px] text-[#555]">{ago(table.activated_at)}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {tables.length === 0 && (
          <div className="text-center py-12 text-[#555]">
            <p>No tables found for this restaurant</p>
          </div>
        )}
      </div>

      {/* Side Panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-30"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-80 bg-[#111] border-l border-[#1f1f1f] z-40 overflow-y-auto"
            >
              <div className="p-5">
                {/* Panel Header */}
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="font-bold text-white text-xl">{selected.display_name || selected.table_number}</h3>
                    <p className="text-xs text-[#555]">{selected.capacity ? `Capacity: ${selected.capacity}` : ''} {selected.section || ''}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[#555] hover:text-white p-1">
                    <X size={20} />
                  </button>
                </div>

                {/* Status Badge */}
                {(() => {
                  const st = STATUS_STYLES[selected.status] || STATUS_STYLES.inactive;
                  return (
                    <div className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl mb-5 border ${st.bg} ${st.border} ${st.text}`}>
                      <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                      {st.label}
                    </div>
                  );
                })()}

                {/* Session Info */}
                {session && (
                  <div className="card p-4 mb-4 space-y-2 relative overflow-hidden">
                    {/* Waiter Add Items Button */}
                    <button onClick={() => router.push(`/${restaurant.slug}/menu?table=${selected.table_number}`)}
                      className="absolute top-3 right-3 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition-colors">
                      <ShoppingBag size={12}/> Add Items
                    </button>
                    
                    <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Session Info</p>
                    
                    {session.customer_name && (
                      <div className="flex items-center gap-2 mb-3 bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a]">
                        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center font-bold text-white">
                          {session.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{session.customer_name}</p>
                          <p className="text-xs text-[#71717a] flex items-center gap-1">
                            {session.customer_phone || 'No phone'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Placed Orders Info vs Unplaced Cart Info */}
                    {(() => {
                      const runningTotal = (session.order_ids || [])
                        .filter(o => !o.is_cancelled)
                        .reduce((sum, o) => sum + (o.subtotal || 0), 0);
                      const totalPlacedItems = (session.order_ids || [])
                        .filter(o => !o.is_cancelled)
                        .reduce((sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
                      const cartLength = (session.cart || []).length;

                      return (
                        <>
                          <div className="flex justify-between border-b border-[#1f1f1f] pb-2 mb-2">
                            <span className="text-sm font-semibold text-[#71717a]">Order Total</span>
                            <span className="text-sm font-bold text-white" style={{ color: brand }}>₹{runningTotal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-[#71717a]">Ordered Items</span>
                            <span className="text-sm font-semibold text-white">{totalPlacedItems} items</span>
                          </div>
                          {cartLength > 0 && (
                            <div className="flex justify-between text-yellow-500/80">
                              <span className="text-sm">In Cart (unplaced)</span>
                              <span className="text-sm font-semibold">{cartLength} items</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {session.status && (
                      <div className="flex justify-between pt-1">
                        <span className="text-sm text-[#71717a]">Status</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/5 text-white capitalize">{session.status}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-4">
                  {/* ACTIVATE — shown for inactive tables */}
                  {selected.status === 'inactive' && (
                    <div className="space-y-4 bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a]">
                      <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Activate Table</p>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-[#555] font-semibold mb-1 block">Customer Name (Optional)</label>
                          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-[#555] font-semibold mb-1 block">WhatsApp Mobile Number (Optional)</label>
                          <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                            placeholder="10-digit number" pattern="[0-9]{10}"
                            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none" />
                        </div>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={activate}
                        disabled={actLoading}
                        className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
                        style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}
                      >
                        {actLoading
                          ? <><Loader2 size={16} className="animate-spin" /> Activating...</>
                          : <><CheckCircle size={16} /> Activate Table</>}
                      </motion.button>
                    </div>
                  )}
                  {['active', 'occupied', 'bill_requested'].includes(selected.status) && session && (
                    <div className="space-y-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => router.push(`/${restaurant.slug}/bill?session=${session._id}&table=${selected.table_number}`)}
                        className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors"
                        style={{ background: brand }}
                      >
                        🧾 View Bill & Settle
                      </motion.button>

                      {session.status !== 'billed' && (
                        <button
                          onClick={finalizeBill}
                          className="w-full py-2.5 rounded-xl font-semibold text-xs text-[#a1a1aa] border border-[#2a2a2a] hover:bg-white/5 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ShoppingBag size={12} /> Mark as Billed / Print
                        </button>
                      )}
                    </div>
                  )}

                  {/* RE-ACTIVATE if occupied (new party) */}
                  {selected.status === 'inactive' && (
                    <p className="text-xs text-[#555] text-center">Table will be activated and a new session will start</p>
                  )}

                  {/* CLOSE TABLE */}
                  {['active', 'occupied', 'bill_requested'].includes(selected.status) && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={deactivate}
                      disabled={actLoading}
                      className="w-full py-3.5 rounded-xl font-semibold text-slate-400 border border-slate-400/30 hover:bg-slate-400/10 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    >
                      {actLoading
                        ? <><Loader2 size={16} className="animate-spin" /> Closing...</>
                        : <><XCircle size={16} /> Close Table</>}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
