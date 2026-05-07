'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { LayoutDashboard, UtensilsCrossed, Table2, Users, Settings, LogOut, Plus, Trash2, Edit2, X, Loader2, Key, Eye, EyeOff, ToggleLeft, ToggleRight, Download, ChevronRight, TrendingUp, DollarSign, Activity, Printer, Share2 } from 'lucide-react';
import { menuApi, tableApi, userApi, restaurantApi, analyticsApi, uploadApi, getBackendUrl, getFullUrl } from '@/lib/api';
import { useRestaurant } from '@/lib/restaurantContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import useAuthStore from '@/store/authStore';
import ImageUpload from '@/components/ui/ImageUpload';

const BACKEND_URL = getBackendUrl();

export default function AdminPage({ params }) {
  const router = useRouter();
  const { user, ready } = useAuthGuard(['restaurant_admin','super_admin']);
  const { restaurant, setRestaurant } = useRestaurant();
  const { clearAuth } = useAuthStore();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {type:'menu'|'staff'|'qr'|'password', data?:{}}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadDynamic = useCallback(async () => {
    if (!restaurant) return;
    try {
      const [t, d] = await Promise.all([
        tableApi.getAll(restaurant._id, {}),
        analyticsApi.dashboard(restaurant._id)
      ]);
      setTables(t.data?.tables || []);
      setStats(d.data);
    } catch (e) { console.error('Dynamic load failed', e); }
  }, [restaurant]);

  const loadStatic = useCallback(async () => {
    if (!restaurant) return;
    if (menu.length === 0) setLoading(true);
    try {
      const [m, s, c] = await Promise.all([
        menuApi.getAll(restaurant._id, {}),
        userApi.getAll({ restaurant_id: restaurant._id }),
        menuApi.getCategories(restaurant._id),
      ]);
      setMenu(m.data?.items || []);
      setStaff(s.data?.users || []);
      if (c.data?.categories) {
        setRestaurant(prev => ({ ...prev, categories: c.data.categories }));
      }
      
      const fetchedCats = c.data?.categories || [];
      const restCats = restaurant.categories || [];
      const mergedMap = new Map();
      
      fetchedCats.forEach(cat => {
        if (cat?.name) mergedMap.set(cat.name.toLowerCase(), { ...cat, originalName: cat.name });
      });
      
      restCats.forEach(cat => {
        if (cat?.name) {
          const key = cat.name.toLowerCase();
          if (!mergedMap.has(key)) mergedMap.set(key, { ...cat, originalName: cat.name });
          else {
            const existing = mergedMap.get(key);
            mergedMap.set(key, { ...existing, image: cat.image || existing.image });
          }
        }
      });
      setCategories(Array.from(mergedMap.values()).map(c => ({ name: c.originalName, image: c.image })));
    } catch { toast.error('Load failed'); }
    finally { setLoading(false); }
  }, [restaurant]);

  useEffect(() => { 
    loadStatic();
    loadDynamic();
    
    // Only poll if no modal is open (prevents UI jumpiness during edits)
    if (!modal) {
      const interval = setInterval(() => loadDynamic(), 10000);
      const staticInterval = setInterval(() => loadStatic(), 60000);
      return () => { clearInterval(interval); clearInterval(staticInterval); };
    }
  }, [loadStatic, loadDynamic, modal]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Menu handlers ──────────────────────────────────────────────────────────
  const saveMenuItem = async () => {
    setSaving(true);
    try {
      // Ensure we store relative paths for our own uploads
      const cleanForm = { ...form };
      if (cleanForm.image && (cleanForm.image.includes('/uploads/') || cleanForm.image.includes('uploads/'))) {
        const parts = cleanForm.image.split('uploads/');
        cleanForm.image = '/uploads/' + parts[parts.length - 1];
      }
      
      if (form._id) await menuApi.update(restaurant._id, form._id, cleanForm);
      else await menuApi.create(restaurant._id, cleanForm);
      toast.success('Saved successfully!'); setModal(null); loadStatic();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteMenuItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    await menuApi.delete(restaurant._id, id); loadStatic();
  };

  // ── Staff handlers ─────────────────────────────────────────────────────────
  const saveStaff = async () => {
    setSaving(true);
    try {
      if (form._id) await userApi.update(form._id, { name: form.name, phone: form.phone });
      else await userApi.create({ ...form, restaurant_id: restaurant._id });
      toast.success('Saved successfully!'); setModal(null); loadStatic();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!form.newPassword || form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await userApi.changePassword(form._id, form.newPassword);
      toast.success('Password updated successfully!'); setModal(null);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggleStaff = async (u) => {
    await userApi.toggleActive(u._id, !u.is_active);
    loadStatic();
  };

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No analytics data available to export yet!');
      return;
    }
    
    let headers = "";
    let rows = "";

    if (filename.includes('sales_revenue')) {
      headers = "Date,Revenue,Transactions\n";
      data.forEach(row => {
        rows += `${row._id},${row.revenue},${row.sessions}\n`;
      });
    } else if (filename.includes('top_selling_items')) {
      headers = "Item Name,Quantity Sold,Total Revenue (INR)\n";
      data.forEach(row => {
        rows += `"${row.name.replace(/"/g, '""')}",${row.totalQty},${row.totalRevenue}\n`;
      });
    } else if (filename.includes('transactions')) {
      headers = "Date,Table,Customer,Phone,Subtotal,GST,Discount,Total,Method\n";
      data.forEach(row => {
        const date = new Date(row.closed_at).toLocaleString();
        rows += `"${date}",${row.table_number},"${(row.customer_name || '').replace(/"/g, '""')}","${row.customer_phone || ''}",${row.subtotal},${row.gst_amount},${row.discount},${row.total},${row.payment_method}\n`;
      });
    }
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully!');
  };

  const exportTransactions = async () => {
    try {
      toast.loading('Preparing report...', { id: 'export' });
      const r = await analyticsApi.transactions(restaurant._id);
      exportCSV(r.data.transactions, 'detailed_transactions');
      toast.dismiss('export');
    } catch (e) { 
      toast.error('Failed to export transactions');
      toast.dismiss('export');
    }
  };

  // ── Category handlers ──────────────────────────────────────────────────────
  const saveCategory = async () => {
    if (!form.name) return toast.error('Name is required');
    setSaving(true);
    try {
      const existingCats = restaurant.categories || [];
      const isEdit = form.originalName !== undefined;
      
      let newCats = [...existingCats];
      if (isEdit) {
        newCats = newCats.map(c => c.name.trim().toLowerCase() === form.originalName.trim().toLowerCase() ? { name: form.name, image: form.image } : c);
      } else {
        if (newCats.find(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase())) throw new Error('Category already exists');
        newCats.push({ name: form.name, image: form.image });
      }

      // Ensure we store relative paths for our own uploads
      const cleanCats = newCats.map(c => {
        if (c.image && (c.image.includes('/uploads/') || c.image.includes('uploads/'))) {
          const parts = c.image.split('uploads/');
          return { ...c, image: '/uploads/' + parts[parts.length - 1] };
        }
        return c;
      });

      await restaurantApi.update(restaurant._id, { categories: cleanCats });
      setRestaurant(r => ({ ...r, categories: cleanCats }));
      toast.success('Category saved!');
      setModal(null);
      // Wait for state to settle before reloading
      setTimeout(() => loadStatic(), 300);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteCategory = async (catName) => {
    if (!confirm(`Delete category ${catName} image mapping?`)) return;
    try {
      const newCats = (restaurant.categories || []).filter(c => c.name !== catName);
      await restaurantApi.update(restaurant._id, { categories: newCats });
      setRestaurant(r => ({ ...r, categories: newCats }));
      toast.success('Category removed!');
      loadStatic();
    } catch (e) { toast.error(e.message); }
  };

  // ── Logo save ──────────────────────────────────────────────────────────────
  const saveLogo = async (url) => {
    await restaurantApi.update(restaurant._id, { logo: url });
    setRestaurant(r => ({ ...r, logo: url }));
    toast.success('Logo updated successfully!');
  };

  const brand = restaurant?.theme_color || 'var(--brand-600)';
  const logoUrl = getFullUrl(restaurant?.logo);

  const TABS = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Analytics' },
    { id: 'menu', icon: UtensilsCrossed, label: 'Menu Management' },
    { id: 'categories', icon: LayoutDashboard, label: 'Categories' },
    { id: 'tables', icon: Table2, label: 'Tables & QR' },
    { id: 'staff', icon: Users, label: 'Staff' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  if (!ready || loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <Loader2 size={32} className="animate-spin mb-4" style={{ color: brand }} />
      <p className="text-gray-500 font-medium text-sm">Loading admin dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen relative bg-[#f8f9fa] font-sans text-gray-900 overflow-hidden">
      {/* Background Setup */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: "url('/posshome.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1 }}></div>
      <div className="fixed inset-0 z-0 bg-white/70 backdrop-blur-[2px] pointer-events-none"></div>

      <div className="relative z-10 flex w-full h-full min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 fixed h-full z-20 shadow-[2px_0_8px_rgba(0,0,0,0.02)]">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="" className="max-h-10 w-auto object-contain drop-shadow-sm" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm" style={{ background: brand }}>{restaurant?.name?.[0]}</div>}
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-[15px] truncate leading-tight">{restaurant?.name}</p>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Admin Portal</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all group ${tab === t.id ? 'font-bold shadow-sm' : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              style={tab === t.id ? { background: `${brand}15`, color: brand } : {}}>
              <t.icon size={18} className={tab === t.id ? '' : 'text-gray-400 group-hover:text-gray-600 transition-colors'} />
              {t.label}
              {tab === t.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={() => { clearAuth(); router.push('/login'); }} 
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-slate-50 hover:text-slate-600 font-semibold text-sm transition-all border border-transparent hover:border-slate-100">
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="ml-64 flex-1 p-8 lg:p-10 max-w-[1400px]">
        
        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Business Analytics</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Real-time performance and sales insights</p>
              </div>
              <div className="flex gap-3">
                <button onClick={exportTransactions}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm rounded-lg text-sm font-bold text-gray-700 transition-all flex items-center gap-2">
                  <Download size={16} className="text-gray-400" /> Export CSV
                </button>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Recent Transactions</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Latest 100</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                      <th className="px-6 py-4 uppercase tracking-wider text-[10px]">Date/Time</th>
                      <th className="px-6 py-4 uppercase tracking-wider text-[10px]">Table</th>
                      <th className="px-6 py-4 uppercase tracking-wider text-[10px]">Customer</th>
                      <th className="px-6 py-4 uppercase tracking-wider text-[10px]">Amount</th>
                      <th className="px-6 py-4 uppercase tracking-wider text-[10px]">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats?.transactions?.map((tx, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-600 whitespace-nowrap">{new Date(tx.closed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{tx.table_number}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{tx.customer_name || 'Anonymous'}</p>
                          <p className="text-[10px] text-gray-500">{tx.customer_phone || ''}</p>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-900">₹{tx.total}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${tx.payment_method === 'cash' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {tx.payment_method}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!stats?.transactions || stats.transactions.length === 0) && (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-gray-400 font-medium italic">No transactions recorded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { l: "Today's Revenue", v: `₹${stats?.todayRevenue || 0}`, d: "Live collections", i: DollarSign, c: 'text-blue-600', bg: 'bg-blue-50' },
                { l: "This Week", v: `₹${stats?.weekRevenue || 0}`, d: "Last 7 days", i: TrendingUp, c: 'text-blue-600', bg: 'bg-blue-50' },
                { l: "This Month", v: `₹${stats?.monthRevenue || 0}`, d: "Last 30 days", i: Activity, c: 'text-purple-600', bg: 'bg-purple-50' },
                { l: "Active Tables", v: stats?.activeTables || 0, d: "Currently dining", i: Users, c: 'text-orange-600', bg: 'bg-orange-50' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">{s.l}</p>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                      <s.i size={16} className={s.c} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-gray-900 tracking-tight">{s.v}</p>
                  <p className="text-[12px] font-medium text-gray-400 mt-2">{s.d}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Daily Sales Chart / Table */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-8">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">7-Day Sales Trend</h3>
                    <p className="text-xs font-medium text-gray-500 mt-1">Revenue over the past week</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-50">
                        <th className="pb-3 font-bold pl-2">Date</th>
                        <th className="pb-3 font-bold text-center">Orders</th>
                        <th className="pb-3 font-bold text-right pr-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(!stats?.revenue_by_day || stats.revenue_by_day.length === 0) ? (
                        <tr><td colSpan="3" className="text-center py-10 text-gray-400 font-medium">No sales data found</td></tr>
                      ) : (
                        stats.revenue_by_day.map(day => (
                          <tr key={day._id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="py-3.5 pl-2 font-bold text-gray-700">{day._id}</td>
                            <td className="py-3.5 text-center text-gray-500 font-semibold">{day.sessions}</td>
                            <td className="py-3.5 pr-2 text-right font-black text-gray-900 group-hover:text-blue-600 transition-colors">₹{day.revenue}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Items */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-4 flex flex-col">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Top Items</h3>
                    <p className="text-xs font-medium text-gray-500 mt-1">Best sellers (30d)</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                  {(!stats?.top_items || stats.top_items.length === 0) ? (
                    <p className="text-center py-10 text-gray-400 font-medium">No top items yet</p>
                  ) : (
                    stats.top_items.map((item, idx) => (
                      <div key={item._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 font-bold text-[10px] flex items-center justify-center shadow-sm">#{idx+1}</span>
                          <p className="font-bold text-gray-800 text-sm truncate">{item.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-bold text-gray-500 uppercase">{item.totalQty} sold</p>
                          <p className="text-sm font-black text-gray-900 mt-0.5">₹{item.totalRevenue}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MENU */}
        {tab === 'menu' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Menu Items</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Manage your restaurant offerings</p>
              </div>
              <button onClick={() => { setForm({ is_available: true, is_veg: true }); setModal('menu'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                style={{ background: brand }}>
                <Plus size={18} /> Add New Item
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {menu.map(item => {
                const img = getFullUrl(item.image) ? `${getFullUrl(item.image)}?t=${new Date(item.updatedAt || Date.now()).getTime()}` : null;
                return (
                  <div key={item._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                    <div className="h-40 bg-gray-50 relative border-b border-gray-100 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">🍽️</div>
                      {img && (
                        <img src={img} alt={item.name} loading="lazy" onError={(e) => { e.target.style.opacity = '0'; }} className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )}
                      
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setForm({ ...item }); setModal('menu'); }}
                          className="w-8 h-8 bg-white/95 backdrop-blur-sm rounded-lg flex items-center justify-center text-gray-700 hover:text-blue-600 shadow-sm border border-gray-200">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteMenuItem(item._id)}
                          className="w-8 h-8 bg-white/95 backdrop-blur-sm rounded-lg flex items-center justify-center text-gray-700 hover:text-slate-600 shadow-sm border border-gray-200">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="absolute bottom-3 left-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider shadow-sm ${item.is_available ? 'bg-white text-blue-600 border border-blue-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                          {item.is_available ? 'Available' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${item.is_veg ? 'border-blue-600' : 'border-slate-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-blue-600' : 'bg-slate-600'}`} />
                          </div>
                          <p className="font-bold text-gray-900 leading-tight">{item.name}</p>
                        </div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide ml-5">{item.category}</p>
                      </div>
                      <p className="text-lg font-black mt-3 ml-5" style={{ color: brand }}>₹{item.price}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Category Images</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Upload premium images for your menu categories</p>
              </div>
              <button onClick={() => { setForm({}); setModal('category'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                style={{ background: brand }}>
                <Plus size={18} /> Add Category
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {categories.map((cat, i) => {
                // Add a cache-buster for categories to ensure updates reflect immediately
                const img = getFullUrl(cat.image) ? `${getFullUrl(cat.image)}?t=${Date.now()}` : null;
                return (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col items-center p-4">
                    <div className="w-24 h-24 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-3 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">🍽️</div>
                      {img && (
                        <img src={img} alt={cat.name} loading="lazy" onError={(e) => { e.target.style.opacity = '0'; }} className="relative z-10 w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                        <button onClick={() => { setForm({ originalName: cat.name, name: cat.name, image: cat.image }); setModal('category'); }}
                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-700 hover:text-blue-600 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteCategory(cat.name)}
                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-700 hover:text-slate-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="font-bold text-gray-900 text-sm text-center">{cat.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABLES */}
        {tab === 'tables' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tables & QR Codes</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Download and print QR codes for tables</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {tables.map(table => {
                const qrUrl = `${typeof window!=='undefined'?window.location.origin:''}/${restaurant?.slug}/menu?table=${table.table_number}`;
                return (
                  <div key={table._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="text-center w-full border-b border-dashed border-gray-200 pb-3">
                      <p className="font-black text-gray-900 text-lg uppercase">{table.display_name || table.table_number}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block uppercase tracking-wider ${table.status==='active'?'bg-blue-50 text-blue-600 border border-blue-100':'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        {table.status}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl">
                      <QRCodeSVG value={qrUrl} size={140} />
                    </div>
                    <button onClick={() => { setModal('qr'); setForm({ qrUrl, name: table.display_name || table.table_number }); }}
                      className="w-full py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                      View & Print QR
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STAFF */}
        {tab === 'staff' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Staff Members</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">Manage waiters and kitchen staff access</p>
              </div>
              <button onClick={() => { setForm({ role: 'waiter' }); setModal('staff'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                style={{ background: brand }}>
                <Plus size={18} /> Add Staff
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {staff.filter(s => !['super_admin','restaurant_admin'].includes(s.role)).map(s => (
                  <div key={s._id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border border-gray-100"
                        style={{ background: `${brand}15`, color: brand }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-base">{s.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${s.is_active?'bg-blue-50 text-blue-600 border-blue-100':'bg-slate-50 text-slate-600 border-slate-100'}`}>
                            {s.is_active?'Active':'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-500 mt-0.5">{s.email} • <span className="uppercase tracking-wider text-[11px] font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{s.role}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleStaff(s)} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors shadow-sm" title={s.is_active?'Deactivate':'Activate'}>
                        {s.is_active ? <ToggleRight size={20} className="text-blue-500" /> : <ToggleLeft size={20} />}
                      </button>
                      <button onClick={() => { setForm({ _id: s._id, name: s.name }); setModal('password'); }}
                        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors shadow-sm" title="Change Password">
                        <Key size={16} />
                      </button>
                      <button onClick={() => { setForm({ ...s }); setModal('staff'); }}
                        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={async () => { if(confirm('Are you sure you want to delete this staff member?')) { await userApi.delete(s._id); load(); } }}
                        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-slate-50 hover:border-slate-200 hover:text-slate-600 transition-colors shadow-sm">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {staff.filter(s => !['super_admin','restaurant_admin'].includes(s.role)).length === 0 && (
                <div className="p-10 text-center">
                  <p className="font-bold text-gray-500">No staff members found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Restaurant Settings</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Configure your brand identity and payment details</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
              
              <div>
                <p className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Brand Logo</p>
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 border-dashed">
                  <ImageUpload type="logo" value={restaurant?.logo || ''} onChange={saveLogo} label="Upload Logo (Shown on UI and QR Codes)" />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Restaurant Name</label>
                  <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" defaultValue={restaurant?.name} id="set-name" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Merchant UPI ID</label>
                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" placeholder="merchant@upi" defaultValue={restaurant?.upi_id} id="set-upi" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">WhatsApp Number</label>
                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" placeholder="+91..." defaultValue={restaurant?.whatsapp_number} id="set-wa" />
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <button onClick={async () => {
                  await restaurantApi.update(restaurant._id, {
                    name: document.getElementById('set-name').value,
                    upi_id: document.getElementById('set-upi').value,
                    whatsapp_number: document.getElementById('set-wa').value,
                  });
                  toast.success('Settings saved successfully!');
                }} className="w-full md:w-auto px-8 py-3.5 rounded-xl text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all" style={{ background: brand }}>
                  Save All Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95, y:20 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-lg overflow-y-auto max-h-[90vh] border border-gray-100">

              {/* MENU MODAL */}
              {modal === 'menu' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-gray-900 text-xl">{form._id ? 'Edit Dish' : 'Add New Dish'}</h3>
                    <button onClick={()=>setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 border-dashed">
                      <ImageUpload value={form.image||''} onChange={v=>setF('image',v)} label="Upload Dish Image" />
                    </div>
                    
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dish Name *</label>
                      <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none" defaultValue={form.name||''} onChange={e=>setF('name',e.target.value)}/>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                        <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none" defaultValue={form.price||''} onChange={e=>setF('price',e.target.value)}/>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                        <input list="category-options" placeholder="e.g. Fast Food" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none" defaultValue={form.category||''} onChange={e=>setF('category',e.target.value)}/>
                        <datalist id="category-options">
                          {categories.map(c => <option key={c.name} value={c.name} />)}
                        </datalist>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                      <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none" defaultValue={form.description||''} onChange={e=>setF('description',e.target.value)}/>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                      {[{k:'is_veg',l:'Vegetarian'},{k:'is_bestseller',l:'Bestseller'},{k:'is_spicy',l:'Spicy'},{k:'is_available',l:'Available'},{k:'is_featured',l:'Featured'}].map(f=>(
                        <label key={f.k} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                          <input type="checkbox" defaultChecked={form[f.k]} onChange={e=>setF(f.k,e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"/>
                          <span className="text-xs font-bold text-gray-700">{f.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
                    <button onClick={()=>setModal(null)} className="flex-1 py-3.5 rounded-xl text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={saveMenuItem} disabled={saving} className="flex-[2] py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all" style={{background:brand}}>
                      {saving ? <Loader2 size={18} className="animate-spin"/> : 'Save Dish'}
                    </button>
                  </div>
                </>
              )}

              {/* CATEGORY MODAL */}
              {modal === 'category' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-gray-900 text-xl">{form.originalName ? 'Edit Category' : 'Add New Category'}</h3>
                    <button onClick={()=>setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 border-dashed text-center">
                      <ImageUpload value={form.image||''} onChange={v=>setF('image',v)} label="Upload Category Icon/Image" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category Name *</label>
                      <input type="text" placeholder="e.g. Fast Food" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none" defaultValue={form.name||''} onChange={e=>setF('name',e.target.value)}/>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">Must exactly match the category name used in Menu Items.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
                    <button onClick={()=>setModal(null)} className="flex-1 py-3.5 rounded-xl text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={saveCategory} disabled={saving} className="flex-[2] py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all" style={{background:brand}}>
                      {saving ? <Loader2 size={18} className="animate-spin"/> : 'Save Category'}
                    </button>
                  </div>
                </>
              )}

              {/* STAFF MODAL */}
              {modal === 'staff' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-gray-900 text-xl">{form._id ? 'Edit Staff Member' : 'Add New Staff'}</h3>
                    <button onClick={()=>setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                      <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" defaultValue={form.name||''} onChange={e=>setF('name',e.target.value)}/>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email *</label>
                      <input type="email" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" defaultValue={form.email||''} onChange={e=>setF('email',e.target.value)}/>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input type="tel" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" defaultValue={form.phone||''} onChange={e=>setF('phone',e.target.value)}/>
                    </div>
                    {!form._id && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
                          <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" onChange={e=>setF('role',e.target.value)} defaultValue="waiter">
                            <option value="waiter">Waiter</option>
                            <option value="kitchen">Kitchen</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                          <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono" onChange={e=>setF('password',e.target.value)}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
                    <button onClick={()=>setModal(null)} className="flex-1 py-3.5 rounded-xl text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={saveStaff} disabled={saving} className="flex-[2] py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all" style={{background:brand}}>
                      {saving ? <Loader2 size={18} className="animate-spin"/> : 'Save Staff'}
                    </button>
                  </div>
                </>
              )}

              {/* PASSWORD MODAL */}
              {modal === 'password' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-gray-900 text-xl">Change Password</h3>
                    <button onClick={()=>setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="bg-orange-50 text-orange-800 text-sm font-medium p-4 rounded-xl mb-5 border border-orange-100">
                    You are changing the password for <span className="font-bold">{form.name}</span>.
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Password (min 6 chars)</label>
                    <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-mono" placeholder="Enter new password" onChange={e=>setF('newPassword',e.target.value)}/>
                  </div>
                  <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
                    <button onClick={()=>setModal(null)} className="flex-1 py-3.5 rounded-xl text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={changePassword} disabled={saving} className="flex-[2] py-3.5 rounded-xl text-white font-bold flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 transition-all" style={{background:brand}}>Update Password</button>
                  </div>
                </>
              )}

              {/* QR MODAL */}
              {modal === 'qr' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-xl uppercase tracking-tight">{form.name}</h3>
                      <p className="text-sm font-medium text-gray-500">Table QR Code</p>
                    </div>
                    <button onClick={()=>setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="flex justify-center p-8 bg-gray-50 border border-gray-200 border-dashed rounded-3xl mx-auto w-fit">
                    <QRCodeSVG value={form.qrUrl} size={240} />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => { window.print(); }} className="flex-1 py-4 rounded-xl text-white font-bold text-[15px] shadow-md hover:shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2" style={{background:brand}}>
                      <Printer size={18} /> Print
                    </button>
                    <button onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Table QR - ${form.name}`,
                          text: `Scan to order from ${restaurant?.name} - ${form.name}`,
                          url: form.qrUrl
                        });
                      } else {
                        navigator.clipboard.writeText(form.qrUrl);
                        toast.success('Link copied to clipboard!');
                      }
                    }} className="flex-1 py-4 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-bold text-[15px] shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex justify-center items-center gap-2">
                      <Share2 size={18} /> Share
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
