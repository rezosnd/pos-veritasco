'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, UtensilsCrossed, LogOut, Loader2, X, Shield,
  Copy, Check, Eye, EyeOff, Key, User, MapPin, QrCode
} from 'lucide-react';
import { restaurantApi, userApi, authApi } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { useAuthGuard } from '@/hooks/useAuthGuard';

// ─── Utility: generate a strong random password ───────────────────────────────
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Copy helper ──────────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-[#71717a] hover:text-white transition-colors shrink-0">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

// ─── Credential row ───────────────────────────────────────────────────────────
function CredRow({ label, value, secret }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1f1f1f] last:border-0">
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
  const [credsModal, setCredsModal] = useState(null); // holds { restaurant, admin }
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
      // 1. Create the restaurant
      const restRes = await restaurantApi.create({
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        upi_id: form.upi_id,
        whatsapp_number: form.whatsapp_number,
        phone: form.phone,
        email: form.email,
        gst_percent: form.gst_percent ? parseFloat(form.gst_percent) : 5,
        theme_color: form.theme_color || '#e85d04',
        table_count: form.table_count ? parseInt(form.table_count) : 10,
      });
      const restaurant = restRes.data.restaurant;

      // 2. Create the restaurant admin account
      const adminRes = await userApi.create({
        name: form.admin_name || `${form.name} Admin`,
        email: form.admin_email,
        password: form.admin_password,
        role: 'restaurant_admin',
        restaurant_id: restaurant._id,
      });

      // 3. Show credentials modal
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
      toast.success(`✅ ${restaurant.name} created with admin account!`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This is irreversible and will delete all data.`)) return;
    try {
      await restaurantApi.delete(id);
      setRestaurants(prev => prev.filter(r => r._id !== id));
      toast.success('Restaurant deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (!ready || loading) {
    return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#111] border-b border-[#1f1f1f] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white font-display">Super Admin</h1>
            <p className="text-[#71717a] text-xs">Platform Management</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-[#a1a1aa] hidden sm:block">{user?.name}</span>
            <button onClick={() => { clearAuth(); router.push('/login'); }}
              className="text-[#71717a] hover:text-red-400 p-2 transition-colors" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-[#71717a] text-sm">Total Restaurants</p>
            <p className="text-3xl font-bold font-display text-purple-400">{restaurants.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-[#71717a] text-sm">Active</p>
            <p className="text-3xl font-bold font-display text-green-400">{restaurants.filter(r => r.is_active).length}</p>
          </div>
          <div className="card p-5 col-span-2 sm:col-span-1">
            <p className="text-[#71717a] text-sm">Platform Version</p>
            <p className="text-lg font-bold font-display text-white">Restaurant POS v1.0</p>
          </div>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-display text-white">Restaurants</h2>
          <button onClick={() => { setCreateModal(true); setForm({ admin_password: genPassword() }); }}
            className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-all">
            <Plus size={16} /> Add Restaurant
          </button>
        </div>

        {/* Restaurant Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map(rest => (
            <motion.div key={rest._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="card p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${rest.theme_color || '#e85d04'}22`, border: `1px solid ${rest.theme_color || '#e85d04'}44` }}>
                  <UtensilsCrossed size={20} style={{ color: rest.theme_color || '#e85d04' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{rest.name}</p>
                  <p className="text-xs text-[#71717a] truncate">{rest.email || '—'}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rest.is_active ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {rest.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#242424] text-[#71717a] capitalize">{rest.subscription?.plan || 'free'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-[#71717a]">
                <div className="flex items-center gap-1.5"><MapPin size={11} /> {rest.latitude?.toFixed(5)}, {rest.longitude?.toFixed(5)}</div>
                <div className="flex items-center gap-1.5"><Key size={11} /> <span className="font-mono text-[#555] truncate">{rest._id}</span></div>
                <div className="flex items-center gap-1.5"><QrCode size={11} /> {rest.table_count || '—'} tables</div>
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => navigator.clipboard.writeText(rest._id).then(() => toast.success('Restaurant ID copied!'))}
                  className="flex-1 text-xs text-center py-1.5 rounded-lg bg-[#1a1a1a] text-[#a1a1aa] hover:text-white hover:bg-[#242424] transition-colors">
                  Copy ID
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(
                    `http://localhost:3000/start?rid=${rest._id}&table=T1`
                  ).then(() => toast.success('QR URL copied!'))}
                  className="flex-1 text-xs text-center py-1.5 rounded-lg bg-[#1a1a1a] text-[#a1a1aa] hover:text-white hover:bg-[#242424] transition-colors">
                  Copy QR URL
                </button>
                <button onClick={() => handleDelete(rest._id, rest.name)}
                  className="px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 text-xs transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}

          {restaurants.length === 0 && (
            <div className="col-span-3 text-center py-16 text-[#71717a]">
              <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-30" />
              <p>No restaurants yet. Add your first one!</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE RESTAURANT MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {createModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
              className="card p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-white text-lg font-display">Add New Restaurant</h3>
                <button onClick={() => setCreateModal(false)}><X size={18} className="text-[#71717a]" /></button>
              </div>

              <div className="space-y-4">
                {/* Restaurant Info */}
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Restaurant Info</p>
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
                    <input type="color" defaultValue="#e85d04" className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border border-[#2a2a2a]"
                      onChange={e => setF('theme_color', e.target.value)} />
                    <span className="text-xs text-[#71717a]">Used for header, buttons & QR pages</span>
                  </div>
                </div>

                {/* Admin Account */}
                <div className="border-t border-[#1f1f1f] pt-4">
                  <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">Admin Login Credentials</p>
                  <p className="text-xs text-[#71717a] mb-3">These credentials will be given to the restaurant owner to log in.</p>
                  <div>
                    <label className="block text-xs text-[#a1a1aa] mb-1">Admin Name</label>
                    <input className="input" placeholder="Owner / Manager name" onChange={e => setF('admin_name', e.target.value)} />
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-[#a1a1aa] mb-1">Admin Email *</label>
                    <input className="input" type="email" placeholder="owner@restaurant.com" onChange={e => setF('admin_email', e.target.value)} />
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-[#a1a1aa] mb-1">Admin Password *</label>
                    <div className="flex gap-2">
                      <input className="input flex-1 font-mono" value={form.admin_password || ''} onChange={e => setF('admin_password', e.target.value)} />
                      <button type="button" onClick={() => setF('admin_password', genPassword())}
                        className="px-3 py-2 rounded-xl bg-[#242424] text-xs text-[#a1a1aa] hover:text-white transition-colors whitespace-nowrap">
                        Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setCreateModal(false)} className="flex-1 btn-ghost" disabled={creating}>Cancel</button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex-1 font-semibold py-3 px-6 rounded-xl text-white bg-purple-600 hover:bg-purple-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {creating ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Restaurant'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREDENTIALS DISPLAY MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {credsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
              className="card p-6 w-full max-w-md">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-green-400/10 flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-green-400" />
                </div>
                <h3 className="font-bold text-white text-lg font-display">Restaurant Created!</h3>
                <p className="text-[#71717a] text-sm mt-1">Share these credentials with the restaurant owner. Save them now — the password won't be shown again.</p>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3">Restaurant Details</p>
                <CredRow label="Restaurant" value={credsModal.restaurant.name} />
                <CredRow label="Slug" value={credsModal.restaurant.slug} />
                <CredRow label="Admin URL" value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/${credsModal.restaurant.slug}/admin`} />
                <CredRow label="Kitchen URL" value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/${credsModal.restaurant.slug}/kitchen`} />
                <CredRow label="Waiter URL" value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/${credsModal.restaurant.slug}/waiter`} />
                <CredRow label="QR Menu URL" value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/${credsModal.restaurant.slug}/menu?table=T1`} />
              </div>

              <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">Admin Login</p>
                <CredRow label="Login URL" value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/login`} />
                <CredRow label="Email" value={credsModal.admin.email} />
                <CredRow label="Password" value={credsModal.admin.password} secret />
                <CredRow label="Role" value="Restaurant Admin" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = `🍽️ Restaurant POS Login Credentials\n\nRestaurant: ${credsModal.restaurant.name}\nRestaurant ID: ${credsModal.restaurant._id}\n\nAdmin Email: ${credsModal.admin.email}\nAdmin Password: ${credsModal.admin.password}\n\nLogin: ${window.location.origin}/login`;
                    navigator.clipboard.writeText(text).then(() => toast.success('All credentials copied!'));
                  }}
                  className="flex-1 btn-ghost flex items-center justify-center gap-2">
                  <Copy size={14} /> Copy All
                </button>
                <button onClick={() => setCredsModal(null)}
                  className="flex-1 font-semibold py-3 px-6 rounded-xl text-white bg-purple-600 hover:bg-purple-500 transition-all">
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
