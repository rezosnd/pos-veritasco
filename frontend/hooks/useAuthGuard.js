import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { restaurantApi, authApi } from '@/lib/api';
import Cookies from 'js-cookie';

/**
 * useAuthGuard — handles auth + hydration + slug routing.
 * 
 * Returns { user, ready }:
 *   ready = false  → show a loading spinner
 *   ready = true   → user is authenticated, render page
 * 
 * If unauthenticated after hydration → redirects to /login.
 * allowedRoles: if provided, only those roles can access.
 */
export function useAuthGuard(allowedRoles = []) {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, _hydrated, setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait until Zustand has rehydrated from localStorage
    if (!_hydrated) return;

    const check = async () => {
      // 1. If we have a user in store, just validate roles
      if (user && isAuthenticated) {
        if (allowedRoles.length && !allowedRoles.includes(user.role)) {
          router.replace('/login');
          return;
        }
        setReady(true);
        return;
      }

      // 2. No user in store — try to restore from cookie token
      const token = Cookies.get('access_token') || (typeof window !== 'undefined' && localStorage.getItem('access_token'));
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const res = await authApi.me();
        const u = res.data.user;
        setAuth(u, token);
        if (allowedRoles.length && !allowedRoles.includes(u.role)) {
          router.replace('/login');
          return;
        }
        setReady(true);
      } catch {
        clearAuth();
        router.replace('/login');
      }
    };

    check();
  }, [_hydrated, user, isAuthenticated]);

  return { user, ready };
}

/**
 * useSlugGuard — like useAuthGuard but also validates that the user
 * belongs to the restaurant identified by `slug` param.
 * 
 * Returns { user, restaurant, ready }
 */
export function useSlugGuard(slug, allowedRoles = []) {
  const [restaurant, setRestaurant] = useState(null);
  const { user, ready } = useAuthGuard(allowedRoles);

  useEffect(() => {
    if (!ready || !slug) return;
    // Restaurant is already provided by RestaurantContext layout
    // Just verify user's restaurant matches the slug
    if (user?.role === 'super_admin') return; // super admin can access all
    restaurantApi.getBySlug(slug)
      .then(res => {
        const r = res.data.restaurant;
        setRestaurant(r);
        // If this user doesn't belong to this restaurant, redirect
        if (user?.restaurant_id && r._id !== user.restaurant_id) {
          // Redirect to their correct slug
          restaurantApi.getById(user.restaurant_id)
            .then(res2 => {
              const correctSlug = res2.data.restaurant.slug;
              window.location.replace(window.location.pathname.replace(slug, correctSlug));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [ready, slug, user]);

  return { user, restaurant, ready };
}
