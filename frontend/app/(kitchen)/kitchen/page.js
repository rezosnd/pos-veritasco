'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import { restaurantApi } from '@/lib/api';

export default function KitchenRedirectPage() {
  const router = useRouter();
  const { user, _hydrated } = useAuthStore();

  useEffect(() => {
    if (!_hydrated) return;
    if (!user) { router.replace('/login'); return; }
    restaurantApi.getById(user.restaurant_id)
      .then(res => router.replace(`/${res.data.restaurant.slug}/kitchen`))
      .catch(() => router.replace('/login'));
  }, [_hydrated, user]);

  return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center"><Loader2 size={28} className="animate-spin text-[#a1a1aa]" /></div>;
}
