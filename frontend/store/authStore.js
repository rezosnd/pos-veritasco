import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      _hydrated: false,       // ← becomes true after localStorage is read

      setAuth: (user, accessToken) => {
        // Accept both (user, token) and ({user, accessToken}) shapes
        if (user && typeof user === 'object' && user.user) {
          // called as setAuth({ user, accessToken, refreshToken })
          const { user: u, accessToken: at, refreshToken: rt } = user;
          if (rt) Cookies.set('refresh_token', rt, { expires: 30, sameSite: 'lax' });
          if (at) Cookies.set('access_token', at, { expires: 7, sameSite: 'lax' });
          set({ user: u, accessToken: at, isAuthenticated: true });
        } else {
          // called as setAuth(user, accessToken)
          if (accessToken) Cookies.set('access_token', accessToken, { expires: 7, sameSite: 'lax' });
          set({ user, accessToken, isAuthenticated: true });
        }
      },

      updateUser: (user) => set({ user }),

      clearAuth: () => {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        if (typeof window !== 'undefined') localStorage.removeItem('auth-storage');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { getItem: ()=>null, setItem: ()=>{}, removeItem: ()=>{} })),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Called once rehydration from localStorage completes
        if (state) state.setHydrated();
      },
    }
  )
);

export default useAuthStore;
