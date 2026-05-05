'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChefHat, Clock, CheckCircle2, RefreshCw, LogOut, Loader2, Wifi, WifiOff, Bell } from 'lucide-react';
import { orderApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useRestaurant } from '@/lib/restaurantContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import useAuthStore from '@/store/authStore';

const COLS = [
  { key:'pending',   label:'Pending',   next:'accepted',  color:'#f59e0b' },
  { key:'accepted',  label:'Accepted',  next:'preparing', color:'#f97316' },
  { key:'preparing', label:'Preparing', next:'ready',     color:'#3b82f6' },
  { key:'ready',     label:'Ready ✓',   next:'served',    color:'var(--brand-500)' },
];

const ago = d => { const m=Math.floor((Date.now()-new Date(d))/60000); return m<1?'now':`${m}m ago`; };

export default function KitchenPage() {
  const router = useRouter();
  const { user, ready } = useAuthGuard(['kitchen','waiter','restaurant_admin','super_admin']);
  const { clearAuth } = useAuthStore();
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [alert, setAlert] = useState(false);


  const load = useCallback(async () => {
    if (!restaurant) return;
    try { const r = await orderApi.getKitchen(restaurant._id); setOrders(r.data.orders||[]); }
    catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [restaurant]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    const s = connectSocket();
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('new-order', o => { setOrders(p => p.find(x=>x._id===o._id)?p:[o,...p]); setAlert(true); setTimeout(()=>setAlert(false),4000); });
    s.on('order-updated', o => setOrders(p => ['served','cancelled'].includes(o.status)?p.filter(x=>x._id!==o._id):p.map(x=>x._id===o._id?o:x)));
    return () => { s.off('new-order'); s.off('order-updated'); };
  }, [restaurant]);

  const advance = async (order, next) => {
    setOrders(p => ['served','cancelled'].includes(next)?p.filter(o=>o._id!==order._id):p.map(o=>o._id===order._id?{...o,status:next}:o));
    const s = connectSocket();
    s.emit('order-status-change', { order_id: order._id, status: next });
  };

  const brand = restaurant?.theme_color || '#e85d04';
  if (!ready || loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 size={28} className="animate-spin text-[#71717a]"/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <AnimatePresence>{alert && <motion.div initial={{y:-60}} animate={{y:0}} exit={{y:-60}} className="fixed top-0 inset-x-0 z-50 bg-yellow-500 text-black text-center py-3 font-bold flex items-center justify-center gap-2"><Bell size={18}/> NEW ORDER!</motion.div>}</AnimatePresence>
      <header className="bg-[#111] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:brand}}><ChefHat size={16} className="text-white"/></div>
          <div><p className="font-bold text-white text-sm">Kitchen Display — {restaurant?.name}</p><p className="text-[10px] text-[#71717a]">{orders.length} active orders</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 text-xs ${connected?'text-blue-400':'text-slate-400'}`}>{connected?<Wifi size={12}/>:<WifiOff size={12}/>}{connected?'Live':'Offline'}</span>
          <button onClick={load} className="text-[#71717a] hover:text-white p-1"><RefreshCw size={15}/></button>
          <button onClick={()=>{clearAuth();router.push('/login');}} className="text-[#71717a] hover:text-slate-400 p-1"><LogOut size={15}/></button>
        </div>
      </header>
      <div className="flex gap-3 p-4 flex-1 overflow-x-auto">
        {COLS.map(col => {
          const colOrders = orders.filter(o=>o.status===col.key);
          return (
            <div key={col.key} className="flex-1 min-w-[260px] flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-3" style={{background:`${col.color}15`,border:`1px solid ${col.color}33`}}>
                <span className="font-bold text-sm" style={{color:col.color}}>{col.label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:`${col.color}22`,color:col.color}}>{colOrders.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                <AnimatePresence>
                  {colOrders.map(order => {
                    const mins = Math.floor((Date.now()-new Date(order.createdAt))/60000);
                    return (
                      <motion.div key={order._id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.9}} className="card p-3" style={mins>=15?{borderColor:'#64748b'}:{}}>
                        <div className="flex justify-between mb-1"><span className="font-bold text-white text-sm">{order.order_number}</span><span className={`text-xs ${mins>=15?'text-slate-400':'text-[#71717a]'}`}>{ago(order.createdAt)}</span></div>
                        <p className="text-xs font-medium mb-2" style={{color:col.color}}>Table {order.table_number}</p>
                        <div className="space-y-1 mb-3">{order.items?.map((item,i)=><div key={i} className="flex justify-between text-sm"><span className="text-[#d4d4d8]">{item.name}</span><span className="font-bold text-white">×{item.quantity}</span></div>)}</div>
                        {order.kitchen_notes && <p className="text-xs text-yellow-400 bg-yellow-400/10 rounded p-2 mb-2">📝 {order.kitchen_notes}</p>}
                        {col.next && <button onClick={()=>advance(order,col.next)} className="w-full py-2 rounded-xl text-xs font-bold transition-all" style={{background:`${col.color}22`,color:col.color,border:`1px solid ${col.color}44`}}>→ Mark {col.next.charAt(0).toUpperCase()+col.next.slice(1)}</button>}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {colOrders.length===0 && <div className="text-center py-8 text-[#333] text-sm">No {col.label.toLowerCase()} orders</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
