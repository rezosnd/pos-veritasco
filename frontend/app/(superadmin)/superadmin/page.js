'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, LogOut, Loader2, X, Shield,
  Copy, Check, Eye, EyeOff, Key, MapPin, QrCode,
  UtensilsCrossed, ChevronRight, Building2, Wifi
} from 'lucide-react';
import { restaurantApi, userApi, authApi } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { useAuthGuard } from '@/hooks/useAuthGuard';

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-[#71717a] hover:text-white transition-colors shrink-0">
      {copied ? <Check size={14} className="text-blue-400" /> : <Copy size={14} />}
    </button>
  );
}

function CredRow({ label, value, secret }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1f2e1f] last:border-0">
      <span className="text-xs text-[#71717a] w-28 shrink-0">{label}</span>
      <span className="font-mono text-sm text-white flex-1 truncate">
        {secret && !show ? '••••••••••••' : value}
      </span>
      <div className="flex items-center gap-1 ml-2">
        {secret && (
          <button onClick={() => setShow(s => !s)} className="text-[#71717a] hover:text-white transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, ready } = useAuthGuard(['super_admin']);
  const { clearAuth } = useAuthStore();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [credsModal, setCredsModal] = useState(null);
  const [form, setForm] = useState({ admin_password: genPassword() });

  const loadRestaurants = useCallback(async () => {
    try {
      const res = await restaurantApi.getAll({ limit: 100 });
      setRestaurants(res.data.restaurants || []);
    } catch { toast.error('Failed to load restaurants'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRestaurants(); }, [loadRestaurants]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.name) return toast.error('Restaurant name is required');
    if (!form.latitude || !form.longitude) return toast.error('GPS coordinates are required');
    if (!form.admin_email) return toast.error('Admin email is required');
    if (!form.admin_password) return toast.error('Admin password is required');
    setCreating(true);
    try {
      const restRes = await restaurantApi.create({
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        upi_id: form.upi_id,
        whatsapp_number: form.whatsapp_number,
        phone: form.phone,
        email: form.email,
        gst_percent: form.gst_percent ? parseFloat(form.gst_percent) : 5,
        theme_color: form.theme_color || 'var(--brand-600)',
        table_count: form.table_count ? parseInt(form.table_count) : 10,
      });
      const restaurant = restRes.data.restaurant;
      const adminRes = await userApi.create({
        name: form.admin_name || `${form.name} Admin`,
        email: form.admin_email,
        password: form.admin_password,
        role: 'restaurant_admin',
        restaurant_id: restaurant._id,
      });
      setCredsModal({
        restaurant,
        admin: {
          name: adminRes.data.user?.name || form.admin_name,
          email: form.admin_email,
          password: form.admin_password,
          role: 'restaurant_admin',
        },
      });
      setCreateModal(false);
      setForm({ admin_password: genPassword() });
      loadRestaurants();
      toast.success(`✅ ${restaurant.name} created!`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This is irreversible.`)) return;
    try {
      await restaurantApi.delete(id);
      setRestaurants(prev => prev.filter(r => r._id !== id));
      toast.success('Restaurant deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 animate-glow-pulse"
            style={{ border: '2px solid rgba(34,197,94,0.4)', background: 'rgba(22,163,74,0.1)' }}>
            <img src="/logo.avif" alt="" className="w-full h-full object-contain p-1" />
          </div>
          <Loader2 size={24} className="animate-spin mx-auto" style={{ color: 'var(--brand-500)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30" style={{ background: 'rgba(10,15,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1a2a1a' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0" style={{ border: '1.5px solid rgba(34,197,94,0.4)', background: 'rgba(22,163,74,0.12)' }}>
            <img src="/logo.avif" alt="Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <div>
            <h1 className="font-bold text-white font-display text-sm leading-tight">Veritasco POS</h1>
            <p className="text-[10px] text-[#71717a] flex items-center gap-1"><Shield size={9} style={{ color: 'var(--brand-500)' }} /> Super Admin</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-[#a1a1aa] hidden sm:block">{user?.name}</span>
            <button
              onClick={() => { clearAuth(); router.push('/login'); }}
              className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-slate-400 px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1a2a1a' }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Restaurants', value: restaurants.length, color: 'var(--brand-500)', icon: Building2 },
            { label: 'Active', value: restaurants.filter(r => r.is_active).length, color: '#4ade80', icon: Wifi },
            { label: 'Platform', value: 'v1.0', color: '#a1a1aa', icon: Shield },
          ].map(s => (
            <div key={s.label} className="card p-4 sm:p-5 relative overflow-hidden" style={{ borderTop: `3px solid ${s.color}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#71717a] text-xs font-medium">{s.label}</p>
                  <p className="text-2xl sm:text-3xl font-extrabold font-display mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
                <s.icon size={22} style={{ color: s.color, opacity: 0.3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Header Row ── */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold font-display text-white">Restaurants</h2>
          <button
            onClick={() => { setCreateModal(true); setForm({ admin_password: genPassword() }); }}
            className="btn-brand flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl"
          >
            <Plus size={16} /> Add Restaurant
          </button>
        </div>

        {/* ── Restaurant Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map(rest => (
            <motion.div
              key={rest._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5 flex flex-col gap-4 hover:border-blue-800 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${rest.theme_color || 'var(--brand-600)'}22`, border: `1px solid ${rest.theme_color || 'var(--brand-600)'}44` }}>
                  <UtensilsCrossed size={20} style={{ color: rest.theme_color || 'var(--brand-600)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{rest.name}</p>
                  <p className="text-xs text-[#71717a] truncate">{rest.email || '—'}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rest.is_active ? 'bg-blue-400/10 text-blue-400' : 'bg-slate-400/10 text-slate-400'}`}>
                      {rest.is_active ? '● Active' : '● Inactive'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a231a] text-[#71717a] capitalize">
                      {rest.subscription?.plan || 'free'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-[#71717a]">
                <div className="flex items-center gap-1.5"><MapPin size={11} /> {rest.latitude?.toFixed(4)}, {rest.longitude?.toFixed(4)}</div>
                <div className="flex items-center gap-1.5"><Key size={11} /> <span className="font-mono text-[#444] truncate">{rest._id}</span></div>
                <div className="flex items-center gap-1.5"><QrCode size={11} /> {rest.table_count || '—'} tables</div>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-[#1a2a1a]">
                <button
                  onClick={() => navigator.clipboard.writeText(rest._id).then(() => toast.success('ID copied!'))}
                  className="flex-1 text-xs text-center py-1.5 rounded-lg bg-[#1a231a] text-[#a1a1aa] hover:text-white hover:bg-[#253025] transition-colors"
                >
                  Copy ID
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${rest.slug}/menu?table=T1`).then(() => toast.success('QR URL copied!'))}
                  className="flex-1 text-xs text-center py-1.5 rounded-lg bg-[#1a231a] text-[#a1a1aa] hover:text-white hover:bg-[#253025] transition-colors"
                >
                  QR URL
                </button>
                <button
                  onClick={() => handleDelete(rest._id, rest.name)}
                  className="px-3 py-1.5 rounded-lg bg-slate-400/10 text-slate-400 hover:bg-slate-400/20 text-xs transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}

          {restaurants.length === 0 && (
            <div className="col-span-3 text-center py-20 text-[#71717a]">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <UtensilsCrossed size={28} className="opacity-40" style={{ color: 'var(--brand-500)' }} />
              </div>
              <p className="font-medium">No restaurants yet</p>
              <p className="text-sm mt-1 text-[#555]">Click "Add Restaurant" to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      <AnimatePresence>
        {createModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
              className="card p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-white text-lg font-display">Add New Restaurant</h3>
                <button onClick={() => setCreateModal(false)} className="text-[#71717a] hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)' }}>Restaurant Info</p>
                <div>
                  <label className="block text-xs text-[#a1a1aa] mb-1">Restaurant Name *</label>
                  <input className="input" placeholder="e.g. Spice Garden" onChange={e => setF('name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Latitude *</label>
                    <input className="input" type="number" step="any" placeholder="28.6139" onChange={e => setF('latitude', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Longitude *</label>
                    <input className="input" type="number" step="any" placeholder="77.2090" onChange={e => setF('longitude', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Phone</label>
                    <input className="input" placeholder="+919876543210" onChange={e => setF('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Email</label>
                    <input className="input" type="email" onChange={e => setF('email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">UPI ID</label>
                    <input className="input" placeholder="name@upi" onChange={e => setF('upi_id', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">WhatsApp</label>
                    <input className="input" placeholder="91XXXXXXXXXX" onChange={e => setF('whatsapp_number', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">GST %</label>
                    <input className="input" type="number" defaultValue="5" onChange={e => setF('gst_percent', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Tables to create</label>
                    <input className="input" type="number" defaultValue="10" onChange={e => setF('table_count', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#a1a1aa] mb-1">Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" defaultValue="var(--brand-600)" className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border border-[#2a3a2a]"
                      onChange={e => setF('theme_color', e.target.value)} />
                    <span className="text-xs text-[#71717a]">Used for header, buttons & QR pages</span>
                  </div>
                </div>

                <div className="border-t border-[#1a2a1a] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--brand-500)' }}>Admin Login Credentials</p>
                  <p className="text-xs text-[#71717a] mb-3">These will be given to the restaurant owner to log in.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#a1a1aa] mb-1">Admin Name</label>
                      <input className="input" placeholder="Owner / Manager name" onChange={e => setF('admin_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a1a1aa] mb-1">Admin Email *</label>
                      <input className="input" type="email" placeholder="owner@restaurant.com" onChange={e => setF('admin_email', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a1a1aa] mb-1">Admin Password *</label>
                      <div className="flex gap-2">
                        <input className="input flex-1 font-mono" value={form.admin_password || ''} onChange={e => setF('admin_password', e.target.value)} />
                        <button type="button" onClick={() => setF('admin_password', genPassword())}
                          className="px-3 py-2 rounded-xl bg-[#1a231a] text-xs text-[#a1a1aa] hover:text-white transition-colors whitespace-nowrap">
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setCreateModal(false)} className="flex-1 btn-ghost" disabled={creating}>Cancel</button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex-1 btn-brand flex items-center justify-center gap-2 disabled:opacity-60">
                  {creating ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Restaurant'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREDENTIALS MODAL ── */}
      <AnimatePresence>
        {credsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
              className="card p-6 w-full max-w-md"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <Check size={28} style={{ color: 'var(--brand-500)' }} />
                </div>
                <h3 className="font-bold text-white text-lg font-display">Restaurant Created! 🎉</h3>
                <p className="text-[#71717a] text-sm mt-1">Save these credentials — the password won't be shown again.</p>
              </div>

              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-xl p-4 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--brand-500)' }}>Restaurant Details</p>
                <CredRow label="Restaurant" value={credsModal.restaurant.name} />
                <CredRow label="Slug" value={credsModal.restaurant.slug} />
                <CredRow label="Admin URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${credsModal.restaurant.slug}/admin`} />
                <CredRow label="Kitchen URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${credsModal.restaurant.slug}/kitchen`} />
                <CredRow label="Waiter URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${credsModal.restaurant.slug}/waiter`} />
                <CredRow label="QR Menu URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${credsModal.restaurant.slug}/menu?table=T1`} />
              </div>

              <div className="bg-[#0a0f0a] border border-[#1a2a1a] rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4ade80' }}>Admin Login</p>
                <CredRow label="Login URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login`} />
                <CredRow label="Email" value={credsModal.admin.email} />
                <CredRow label="Password" value={credsModal.admin.password} secret />
                <CredRow label="Role" value="Restaurant Admin" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = `🍽️ Veritasco POS Login Credentials\n\nRestaurant: ${credsModal.restaurant.name}\n\nAdmin Email: ${credsModal.admin.email}\nAdmin Password: ${credsModal.admin.password}\n\nLogin: ${window.location.origin}/login`;
                    navigator.clipboard.writeText(text).then(() => toast.success('All credentials copied!'));
                  }}
                  className="flex-1 btn-ghost flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> Copy All
                </button>
                <button onClick={() => setCredsModal(null)} className="flex-1 btn-brand">Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
