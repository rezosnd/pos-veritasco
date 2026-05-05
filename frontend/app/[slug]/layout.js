'use client';


import { RestaurantProvider } from '@/lib/restaurantContext';
import { Toaster } from 'react-hot-toast';

export default function SlugLayout({ children, params }) {
  return (
    <RestaurantProvider slug={params.slug}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a' } }} />
      {children}
    </RestaurantProvider>
  );
}
