'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { LayoutDashboard, UtensilsCrossed, Table2, Users, Settings, LogOut, Plus, Trash2, Edit2, X, Loader2, Key, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { menuApi, tableApi, userApi, restaurantApi, analyticsApi, uploadApi } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import useAuthStore from '@/store/authStore';
import ImageUpload from '@/components/ui/ImageUpload';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api','') || 'http://localhost:5000';

export default function AdminPage({ params }) {
  const router = useRouter();
  const { user, ready } = useAuthGuard(['restaurant_admin','super_admin']);
  const { restaurant, setRestaurant } = useRestaurant();
  const { clearAuth } = useAuthStore();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {type:'menu'|'staff'|'qr'|'password', data?:{}}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);


  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    try {
      const [m, t, s] = await Promise.all([
        menuApi.getAll(restaurant._id, {}),
        tableApi.getAll(restaurant._id, {}),
        userApi.getAll({ restaurant_id: restaurant._id }),
      ]);
      setMenu(m.data.items || []);
      setTables(t.data.tables || []);
      setStaff(s.data.users || []);
      analyticsApi.dashboard(restaurant._id).then(r => setStats(r.data)).catch(() => {});
    } catch { toast.error('Load failed'); }
    finally { setLoading(false); }
  }, [restaurant]);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Menu handlers ──────────────────────────────────────────────────────────
  const saveMenuItem = async () => {
    setSaving(true);
    try {
      if (form._id) await menuApi.update(restaurant._id, form._id, form);
      else await menuApi.create(restaurant._id, form);
      toast.success('Saved!'); setModal(null); load();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteMenuItem = async (id) => {
    if (!confirm('Delete item?')) return;
    await menuApi.delete(restaurant._id, id); load();
  };

  // ── Staff handlers ─────────────────────────────────────────────────────────
  const saveStaff = async () => {
    setSaving(true);
    try {
      if (form._id) await userApi.update(form._id, { name: form.name, phone: form.phone });
      else await userApi.create({ ...form, restaurant_id: restaurant._id });
      toast.success('Saved!'); setModal(null); load();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!form.newPassword || form.newPassword.length < 6) return toast.error('Min 6 chars');
    setSaving(true);
    try {
      await userApi.changePassword(form._id, form.newPassword);
      toast.success('Password changed!'); setModal(null);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggleStaff = async (u) => {
    await userApi.toggleActive(u._id, !u.is_active);
    load();
  };

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No analytics data available to export yet!');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (filename.includes('sales_revenue')) {
      csvContent += "Date,Revenue,Transactions\n";
      data.forEach(row => {
        csvContent += `${row._id},${row.revenue},${row.sessions}\n`;
      });
    } else if (filename.includes('top_selling_items')) {
      csvContent += "Item Name,Quantity Sold,Total Revenue (INR)\n";
      data.forEach(row => {
        csvContent += `"${row.name.replace(/"/g, '""')}",${row.totalQty},${row.totalRevenue}\n`;
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully!');
  };

  // ── Logo save ──────────────────────────────────────────────────────────────
  const saveLogo = async (url) => {
    await restaurantApi.update(restaurant._id, { logo: url });
    setRestaurant(r => ({ ...r, logo: url }));
    toast.success('Logo updated!');
  };

  const brand = restaurant?.theme_color || '#e85d04';
  const logoUrl = restaurant?.logo ? (restaurant.logo.startsWith('http') ? restaurant.logo : `${BACKEND_URL}${restaurant.logo}`) : null;

  const TABS = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu' },
    { id: 'tables', icon: Table2, label: 'Tables & QR' },
    { id: 'staff', icon: Users, label: 'Staff' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  if (!ready || loading) return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center"><Loader2 size={28} className="animate-spin text-[#a1a1aa]" /></div>;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111] border-r border-[#1f1f1f] flex flex-col shrink-0 fixed h-full z-20">
        <div className="p-4 border-b border-[#1f1f1f] flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover" /> : <div className="w-9 h-9 rounded-xl" style={{ background: brand }} />}
          <div className="min-w-0"><p className="font-bold text-white text-sm truncate">{restaurant?.name}</p><p className="text-[10px] text-[#71717a]">Admin</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${tab===t.id ? 'text-white font-semibold' : 'text-[#71717a] hover:text-white hover:bg-[#1a1a1a]'}`}
              style={tab===t.id ? { background: `${brand}22`, color: brand } : {}}>
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1f1f1f]">
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#71717a] hover:text-red-400 text-sm transition-colors">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white font-display">Analytics Dashboard</h2>
                <p className="text-xs text-[#71717a] mt-0.5">Real-time sales, insights, and report exports for {restaurant?.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportCSV(stats?.revenue_by_day || [], 'sales_revenue_history')}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-1.5"
                >
                  📥 Export Sales (CSV)
                </button>
                <button
                  onClick={() => exportCSV(stats?.top_items || [], 'top_selling_items')}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-1.5"
                >
                  📥 Export Top Items (CSV)
                </button>
              </div>
            </div>

            {/* Sales Revenue Performance Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { l: "Today's Sale", v: `₹${stats?.todayRevenue || 0}`, d: "Live today's collections", c: '#10b981' },
                { l: "This Week's Sale", v: `₹${stats?.weekRevenue || 0}`, d: "Rolling last 7 days", c: '#f59e0b' },
                { l: "This Month's Sale", v: `₹${stats?.monthRevenue || 0}`, d: "Rolling last 30 days", c: '#8b5cf6' },
                { l: 'Active Tables', v: stats?.activeTables || 0, d: "Currently dining guests", c: brand },
              ].map(s => (
                <div key={s.l} className="card p-5 relative overflow-hidden border-t-4" style={{ borderTopColor: s.c }}>
                  <p className="text-[#71717a] text-xs font-medium uppercase tracking-wider">{s.l}</p>
                  <p className="text-3xl font-extrabold font-display mt-2 text-white">{s.v}</p>
                  <p className="text-[10px] text-[#555] mt-1 font-medium">{s.d}</p>
                </div>
              ))}
            </div>

            {/* Secondary Operational Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-[#71717a] text-xs font-medium uppercase">Today's Total Orders</p>
                  <p className="text-2xl font-bold mt-1 text-white">{stats?.todayOrders || 0}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full">Active</span>
              </div>
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-[#71717a] text-xs font-medium uppercase">Total Active Menu Items</p>
                  <p className="text-2xl font-bold mt-1 text-white">{menu.length}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">Online</span>
              </div>
            </div>

            {/* Detailed Analytics Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Daily Sales History Table */}
              <div className="card p-5 lg:col-span-7">
                <div className="flex items-center justify-between mb-4 border-b border-[#1f1f1f] pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">Daily Sales History</h3>
                    <p className="text-[10px] text-[#71717a] mt-0.5">Summary of transactions from the past 7 days</p>
                  </div>
                  <button
                    onClick={() => exportCSV(stats?.revenue_by_day || [], 'sales_revenue_history')}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[#71717a] uppercase tracking-wider border-b border-[#1f1f1f] pb-2">
                        <th className="pb-2 font-semibold">Date</th>
                        <th className="pb-2 font-semibold text-center">Transactions</th>
                        <th className="pb-2 font-semibold text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f1f]">
                      {(!stats?.revenue_by_day || stats.revenue_by_day.length === 0) ? (
                        <tr>
                          <td colSpan="3" className="text-center py-8 text-[#555]">No sales history found</td>
                        </tr>
                      ) : (
                        stats.revenue_by_day.map(day => (
                          <tr key={day._id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                            <td className="py-2.5 font-medium text-white">{day._id}</td>
                            <td className="py-2.5 text-center text-zinc-300 font-semibold">{day.sessions} sales</td>
                            <td className="py-2.5 text-right font-bold text-emerald-400">₹{day.revenue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Selling Items Table */}
              <div className="card p-5 lg:col-span-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#1f1f1f] pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wide">🏆 Best Sellers</h3>
                    <p className="text-[10px] text-[#71717a] mt-0.5">Top performing items in the last 30 days</p>
                  </div>
                  <button
                    onClick={() => exportCSV(stats?.top_items || [], 'top_selling_items')}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="space-y-3">
                  {(!stats?.top_items || stats.top_items.length === 0) ? (
                    <p className="text-center py-8 text-xs text-[#555]">No sales data recorded yet</p>
                  ) : (
                    stats.top_items.map((item, idx) => (
                      <div key={item._id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1a1a]/40 hover:bg-[#1a1a1a]/80 transition-colors border border-[#1f1f1f]">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-400 font-bold text-[10px] flex items-center justify-center">#{idx+1}</span>
                          <p className="font-semibold text-white text-xs truncate">{item.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-zinc-400 font-bold">{item.totalQty} sold</p>
                          <p className="text-xs font-bold text-emerald-400 mt-0.5">₹{item.totalRevenue}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quick References Card */}
            <div className="card p-5">
              <p className="text-[#71717a] text-xs font-bold uppercase tracking-wider mb-2">Operational Access URLs</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="p-3 bg-[#131313] border border-[#1f1f1f] rounded-xl">
                  <p className="text-[10px] text-[#555] font-bold uppercase">Staff Terminal Portal</p>
                  <p className="font-mono text-xs text-white mt-1 select-all">{typeof window !== 'undefined' ? window.location.origin : ''}/login</p>
                </div>
                <div className="p-3 bg-[#131313] border border-[#1f1f1f] rounded-xl">
                  <p className="text-[10px] text-[#555] font-bold uppercase">Active Customer QR Destination Example</p>
                  <p className="font-mono text-xs text-white mt-1 select-all">{typeof window !== 'undefined' ? window.location.origin : ''}/{restaurant?.slug}/menu?table=T1</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MENU */}
        {tab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-display">Menu Items</h2>
              <button onClick={() => { setForm({ is_available: true, is_veg: true }); setModal('menu'); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: brand }}>
                <Plus size={16} /> Add Item
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menu.map(item => {
                const img = item.image ? (item.image.startsWith('http') ? item.image : `${BACKEND_URL}${item.image}`) : null;
                return (
                  <div key={item._id} className="card overflow-hidden">
                    <div className="h-36 bg-[#1a1a1a] relative">
                      {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button onClick={() => { setForm({ ...item }); setModal('menu'); }}
                          className="w-7 h-7 bg-[#111]/80 rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-white">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => deleteMenuItem(item._id)}
                          className="w-7 h-7 bg-red-500/80 rounded-lg flex items-center justify-center text-white">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.is_available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-[#71717a]">{item.category}</p>
                      <p className="text-lg font-bold mt-1" style={{ color: brand }}>₹{item.price}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABLES */}
        {tab === 'tables' && (
          <div>
            <h2 className="text-2xl font-bold text-white font-display mb-6">Tables & QR Codes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map(table => {
                const qrUrl = `${typeof window!=='undefined'?window.location.origin:''}/${restaurant?.slug}/menu?table=${table.table_number}`;
                return (
                  <div key={table._id} className="card p-4 flex flex-col items-center gap-3">
                    <p className="font-bold text-white">{table.display_name || table.table_number}</p>
                    <div className="p-2 bg-white rounded-xl">
                      <QRCodeSVG value={qrUrl} size={120}
                        imageSettings={logoUrl ? { src: logoUrl, height: 24, width: 24, excavate: true } : undefined}
                      />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${table.status==='active'?'bg-green-400/10 text-green-400':'bg-[#242424] text-[#71717a]'}`}>
                      {table.status}
                    </span>
                    <button onClick={() => { setModal('qr'); setForm({ qrUrl, name: table.display_name || table.table_number }); }}
                      className="text-xs text-[#71717a] hover:text-white transition-colors">View Full QR</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STAFF */}
        {tab === 'staff' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-display">Staff</h2>
              <button onClick={() => { setForm({ role: 'waiter' }); setModal('staff'); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: brand }}>
                <Plus size={16} /> Add Staff
              </button>
            </div>
            <div className="space-y-3">
              {staff.filter(s => !['super_admin','restaurant_admin'].includes(s.role)).map(s => (
                <div key={s._id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0"
                    style={{ background: `${brand}33`, color: brand }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{s.name}</p>
                    <p className="text-xs text-[#71717a]">{s.email} · <span className="capitalize">{s.role}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active?'bg-green-400/10 text-green-400':'bg-red-400/10 text-red-400'}`}>
                      {s.is_active?'Active':'Inactive'}
                    </span>
                    <button onClick={() => toggleStaff(s)} className="text-[#71717a] hover:text-white p-1" title={s.is_active?'Deactivate':'Activate'}>
                      {s.is_active ? <ToggleRight size={18} style={{ color: brand }} /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => { setForm({ _id: s._id, name: s.name }); setModal('password'); }}
                      className="text-[#71717a] hover:text-yellow-400 p-1" title="Change Password">
                      <Key size={16} />
                    </button>
                    <button onClick={() => { setForm({ ...s }); setModal('staff'); }}
                      className="text-[#71717a] hover:text-white p-1">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={async () => { if(confirm('Delete?')) { await userApi.delete(s._id); load(); } }}
                      className="text-[#71717a] hover:text-red-400 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div className="max-w-lg">
            <h2 className="text-2xl font-bold text-white font-display mb-6">Restaurant Settings</h2>
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-3">Restaurant Logo</p>
                <ImageUpload type="logo" value={restaurant?.logo || ''} onChange={saveLogo} label="Logo (square, shown in QR codes)" />
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Restaurant Name</label>
                <input className="input" defaultValue={restaurant?.name} id="set-name" />
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">UPI ID</label>
                <input className="input" defaultValue={restaurant?.upi_id} id="set-upi" />
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">WhatsApp</label>
                <input className="input" defaultValue={restaurant?.whatsapp_number} id="set-wa" />
              </div>
              <button onClick={async () => {
                await restaurantApi.update(restaurant._id, {
                  name: document.getElementById('set-name').value,
                  upi_id: document.getElementById('set-upi').value,
                  whatsapp_number: document.getElementById('set-wa').value,
                });
                toast.success('Settings saved!');
              }} className="w-full py-3 rounded-xl text-white font-semibold" style={{ background: brand }}>
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity:0,scale:0.93 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0,scale:0.93 }}
              className="card p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">

              {/* MENU MODAL */}
              {modal === 'menu' && (
                <>
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-white text-lg">{form._id?'Edit':'Add'} Menu Item</h3><button onClick={()=>setModal(null)}><X size={18} className="text-[#71717a]"/></button></div>
                  <div className="space-y-3">
                    <ImageUpload value={form.image||''} onChange={v=>setF('image',v)} label="Item Image" />
                    {[{k:'name',l:'Name *',t:'text'},{k:'price',l:'Price (₹) *',t:'number'},{k:'category',l:'Category',t:'text'},{k:'description',l:'Description',t:'text'}].map(f=>(
                      <div key={f.k}><label className="block text-xs text-[#a1a1aa] mb-1">{f.l}</label>
                      <input type={f.t} className="input" defaultValue={form[f.k]||''} onChange={e=>setF(f.k,e.target.value)}/></div>
                    ))}
                    <div className="grid grid-cols-3 gap-2">
                      {[{k:'is_veg',l:'Veg'},{k:'is_bestseller',l:'Bestseller'},{k:'is_spicy',l:'Spicy'},{k:'is_available',l:'Available'},{k:'is_featured',l:'Featured'}].map(f=>(
                        <label key={f.k} className="flex items-center gap-2 text-sm text-[#a1a1aa] cursor-pointer">
                          <input type="checkbox" defaultChecked={form[f.k]} onChange={e=>setF(f.k,e.target.checked)} className="accent-[var(--brand-color)]"/>
                          {f.l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={()=>setModal(null)} className="flex-1 btn-ghost">Cancel</button>
                    <button onClick={saveMenuItem} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2" style={{background:brand}}>
                      {saving&&<Loader2 size={14} className="animate-spin"/>} Save
                    </button>
                  </div>
                </>
              )}

              {/* STAFF MODAL */}
              {modal === 'staff' && (
                <>
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-white text-lg">{form._id?'Edit':'Add'} Staff</h3><button onClick={()=>setModal(null)}><X size={18} className="text-[#71717a]"/></button></div>
                  <div className="space-y-3">
                    {[{k:'name',l:'Full Name *',t:'text'},{k:'email',l:'Email *',t:'email'},{k:'phone',l:'Phone',t:'text'}].map(f=>(
                      <div key={f.k}><label className="block text-xs text-[#a1a1aa] mb-1">{f.l}</label>
                      <input type={f.t} className="input" defaultValue={form[f.k]||''} onChange={e=>setF(f.k,e.target.value)}/></div>
                    ))}
                    {!form._id && <>
                      <div><label className="block text-xs text-[#a1a1aa] mb-1">Role</label>
                        <select className="input" onChange={e=>setF('role',e.target.value)}>
                          <option value="waiter">Waiter</option><option value="kitchen">Kitchen</option>
                        </select>
                      </div>
                      <div><label className="block text-xs text-[#a1a1aa] mb-1">Password</label>
                        <input type="text" className="input font-mono" onChange={e=>setF('password',e.target.value)}/></div>
                    </>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={()=>setModal(null)} className="flex-1 btn-ghost">Cancel</button>
                    <button onClick={saveStaff} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold" style={{background:brand}}>Save</button>
                  </div>
                </>
              )}

              {/* PASSWORD MODAL */}
              {modal === 'password' && (
                <>
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-white text-lg">Change Password</h3><button onClick={()=>setModal(null)}><X size={18} className="text-[#71717a]"/></button></div>
                  <p className="text-[#71717a] text-sm mb-4">Changing password for <span className="text-white font-semibold">{form.name}</span></p>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">New Password (min 6 chars)</label>
                    <input type="text" className="input font-mono" placeholder="Enter new password" onChange={e=>setF('newPassword',e.target.value)}/>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={()=>setModal(null)} className="flex-1 btn-ghost">Cancel</button>
                    <button onClick={changePassword} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold" style={{background:brand}}>Update Password</button>
                  </div>
                </>
              )}

              {/* QR MODAL */}
              {modal === 'qr' && (
                <>
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-white text-lg">{form.name} — QR Code</h3><button onClick={()=>setModal(null)}><X size={18} className="text-[#71717a]"/></button></div>
                  <div className="flex justify-center p-4 bg-white rounded-2xl">
                    <QRCodeSVG value={form.qrUrl} size={220}
                      imageSettings={logoUrl ? { src: logoUrl, height: 44, width: 44, excavate: true } : undefined}
                    />
                  </div>
                  <p className="text-xs text-[#71717a] text-center mt-3 break-all">{form.qrUrl}</p>
                  <button onClick={() => { window.print(); }} className="w-full mt-3 py-3 rounded-xl text-white font-semibold" style={{background:brand}}>Print QR</button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
