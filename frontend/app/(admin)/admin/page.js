'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import { restaurantApi } from '@/lib/api';

// These pages redirect to the correct slug-based routes
// /admin → /spice-garden/admin, /waiter → /spice-garden/waiter etc.
export default function AdminRedirectPage() {
  const router = useRouter();
  const { user, _hydrated } = useAuthStore();

  useEffect(() => {
    if (!_hydrated) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role === 'super_admin') { router.replace('/superadmin'); return; }
    restaurantApi.getById(user.restaurant_id)
      .then(res => {
        const slug = res.data.restaurant.slug;
        if (user.role === 'restaurant_admin') router.replace(`/${slug}/admin`);
        else if (user.role === 'waiter') router.replace(`/${slug}/waiter`);
        else if (user.role === 'kitchen') router.replace(`/${slug}/kitchen`);
        else router.replace(`/${slug}/admin`);
      })
      .catch(() => router.replace('/login'));
  }, [_hydrated, user]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#a1a1aa]" />
    </div>
  );
}
