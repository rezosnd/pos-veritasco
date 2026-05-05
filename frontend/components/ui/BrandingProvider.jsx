'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';

/**
 * Applies restaurant branding (theme_color) as CSS variables across all pages.
 * Wrap customer-facing layouts with this component.
 */
export default function BrandingProvider({ restaurantId, children }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    // Restore from sessionStorage for instant apply
    const cached = sessionStorage.getItem(`brand_${restaurantId}`);
    if (cached) {
      const { theme_color } = JSON.parse(cached);
      document.documentElement.style.setProperty('--brand-color', theme_color);
      setLoaded(true);
    }
  }, [restaurantId]);

  return <>{children}</>;
}
