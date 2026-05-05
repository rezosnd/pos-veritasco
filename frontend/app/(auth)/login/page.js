'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    if (_hydrated && user && !redirecting) {
      setRedirecting(true);
      redirectByRole(user);
    }
  }, [_hydrated, user]);

  const redirectByRole = async (u) => {
    if (u.role === 'super_admin') { router.push('/superadmin'); return; }
    try {
      const res = await restaurantApi.getById(u.restaurant_id);
      const slug = res.data.restaurant.slug;
      if (u.role === 'restaurant_admin') router.push(`/${slug}/admin`);
      else if (u.role === 'waiter') router.push(`/${slug}/waiter`);
      else if (u.role === 'kitchen') router.push(`/${slug}/kitchen`);
      else router.push(`/${slug}/admin`);
    } catch {
      if (u.role === 'restaurant_admin') router.push('/admin');
      else if (u.role === 'waiter') router.push('/waiter');
      else if (u.role === 'kitchen') router.push('/kitchen');
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) return toast.error('Please enter email and password');
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
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f8f3' }}>

      {/* ── Left Panel — Image Hero (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img
          src="/premium-hero.png"
          alt="Restaurant"
          className="w-full h-full object-cover"
        />
        {/* Dark gradient from bottom */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.05) 100%)'
        }} />
        {/* Brand text over image */}
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1">
              <img src="/logo.avif" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-bold text-lg font-display">Veritasco POS</span>
          </div>
          <h2 className="text-white text-3xl font-bold font-display leading-snug mb-2">
            Complete restaurant<br />management platform
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            QR ordering, kitchen display, live analytics — all in one place.
          </p>
          {/* 3 small stat pills */}
          <div className="flex gap-3 mt-6">
            {[
              { label: 'Orders / min', value: '120+' },
              { label: 'Restaurants', value: '500+' },
              { label: 'Uptime', value: '99.9%' },
            ].map(s => (
              <div key={s.label} className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <p className="text-white font-bold text-sm">{s.value}</p>
                <p className="text-white/50 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-0" style={{ background: '#f8f8f3' }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-[380px]"
        >
          {/* Mobile logo (only shows on mobile) */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-sm p-1">
              <img src="/logo.avif" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-[#1a1a1a] text-lg font-display">Veritasco POS</span>
          </div>

          <h1 className="text-[28px] font-bold text-[#1a1a1a] font-display leading-tight mb-1">
            Sign in
          </h1>
          <p className="text-[#888] text-sm mb-8">
            Enter your credentials to access your dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[13px] font-medium text-[#444] mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl text-[15px] text-[#1a1a1a] outline-none transition-all"
                style={{
                  background: '#fff',
                  border: '1.5px solid #e8e8e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand-600)'}
                onBlur={e => e.target.style.borderColor = '#e8e8e8'}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] font-medium text-[#444] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-[15px] text-[#1a1a1a] outline-none transition-all"
                  style={{
                    background: '#fff',
                    border: '1.5px solid #e8e8e8',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand-600)'}
                  onBlur={e => e.target.style.borderColor = '#e8e8e8'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555] transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{
                background: loading ? 'var(--brand-700)' : 'var(--brand-600)',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Signing in...</>
                : <><span>Sign In</span><ArrowRight size={18} /></>
              }
            </button>
          </form>

          <p className="text-center text-[12px] text-[#bbb] mt-8">
            © {new Date().getFullYear()} Veritasco · Secure login
          </p>
        </motion.div>
      </div>
    </div>
  );
}
