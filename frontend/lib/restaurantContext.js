'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { restaurantApi } from '@/lib/api';

const RestaurantContext = createContext(null);

export function RestaurantProvider({ slug, children }) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    restaurantApi.getBySlug(slug)
      .then(res => {
        const r = res.data.restaurant;
        setRestaurant(r);
        // Apply branding globally
        if (r.theme_color) {
          document.documentElement.style.setProperty('--brand-color', r.theme_color);
          document.documentElement.style.setProperty('--brand-color-light', `${r.theme_color}22`);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <RestaurantContext.Provider value={{ restaurant, loading, error, setRestaurant }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used inside RestaurantProvider');
  return ctx;
}
