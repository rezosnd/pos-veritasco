'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, UtensilsCrossed, Loader2 } from 'lucide-react';
import { authApi, restaurantApi } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const router = useRouter();
  const { user, setAuth, _hydrated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Only auto-redirect AFTER hydration is complete and user exists
  useEffect(() => {
    if (_hydrated && user && !redirecting) {
      setRedirecting(true);
      redirectByRole(user);
    }
  }, [_hydrated, user]);

  const redirectByRole = async (u) => {
    if (u.role === 'super_admin') { router.push('/superadmin'); return; }
    // Fetch restaurant slug for slug-based routes
    try {
      const res = await restaurantApi.getById(u.restaurant_id);
      const slug = res.data.restaurant.slug;
      if (u.role === 'restaurant_admin') router.push(`/${slug}/admin`);
      else if (u.role === 'waiter') router.push(`/${slug}/waiter`);
      else if (u.role === 'kitchen') router.push(`/${slug}/kitchen`);
      else router.push(`/${slug}/admin`);
    } catch {
      // fallback to generic routes
      if (u.role === 'restaurant_admin') router.push('/admin');
      else if (u.role === 'waiter') router.push('/waiter');
      else if (u.role === 'kitchen') router.push('/kitchen');
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) return toast.error('Enter email and password');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { user: u, accessToken, refreshToken } = res.data;
      Cookies.set('access_token', accessToken, { expires: 7 });
      Cookies.set('refresh_token', refreshToken, { expires: 30 });
      setAuth(u, accessToken);
      toast.success(`Welcome, ${u.name}!`);
      await redirectByRole(u);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background:'linear-gradient(135deg,#e85d04,#f97316)' }}>
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white font-display">Restaurant POS</h1>
          <p className="text-[#71717a] text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs text-[#a1a1aa] mb-1">Email</label>
            <input id="login-email" type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@restaurant.com" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-[#a1a1aa] mb-1">Password</label>
            <div className="relative">
              <input id="login-password" type={showPw?'text':'password'} className="input pr-10" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <button id="login-btn" type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background:'linear-gradient(135deg,#e85d04,#f97316)' }}>
            {loading ? <><Loader2 size={16} className="animate-spin"/> Signing in...</> : 'Sign In'}
          </button>
        </form>

        {/* Quick Login Buttons */}
        <div className="mt-4">
          <p className="text-xs text-[#555] text-center mb-3">Demo Quick Login</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label:'Super Admin',   e:'admin@restaurantpos.com',          p:'Admin@123456' },
              { label:'Rest. Admin',   e:'restaurantadmin@spicegarden.com',  p:'Admin@123456' },
              { label:'Waiter',        e:'waiter@spicegarden.com',           p:'Waiter@123' },
              { label:'Kitchen',       e:'kitchen@spicegarden.com',          p:'Kitchen@123' },
            ].map(q => (
              <button key={q.label} onClick={()=>quickFill(q.e,q.p)}
                className="text-xs py-2 px-3 rounded-xl bg-[#1a1a1a] text-[#a1a1aa] hover:text-white hover:bg-[#242424] transition-all border border-[#2a2a2a]">
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
