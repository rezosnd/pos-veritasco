import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      cart: [],
      sessionId: null,
      restaurantId: null,
      tableNumber: null,

      setSession: (sessionId, restaurantId, tableNumber) =>
        set({ sessionId, restaurantId, tableNumber }),

      // Replace entire cart (from socket sync)
      setCart: (cart) => set({ cart }),

      addItem: (item) =>
        set((state) => {
          const existing = state.cart.find((i) => i.menu_item_id === item.menu_item_id);
          if (existing) {
            return {
              cart: state.cart.map((i) =>
                i.menu_item_id === item.menu_item_id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { cart: [...state.cart, { ...item, quantity: 1 }] };
        }),

      removeItem: (menuItemId) =>
        set((state) => {
          const existing = state.cart.find((i) => i.menu_item_id === menuItemId);
          if (!existing) return state;
          if (existing.quantity === 1) {
            return { cart: state.cart.filter((i) => i.menu_item_id !== menuItemId) };
          }
          return {
            cart: state.cart.map((i) =>
              i.menu_item_id === menuItemId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          };
        }),

      updateQuantity: (menuItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) return { cart: state.cart.filter((i) => i.menu_item_id !== menuItemId) };
          return { cart: state.cart.map((i) => i.menu_item_id === menuItemId ? { ...i, quantity } : i) };
        }),

      clearCart: () => set({ cart: [] }),

      clearSession: () => set({ cart: [], sessionId: null, restaurantId: null, tableNumber: null }),

      // Computed
      getItemQty: (menuItemId) => get().cart.find((i) => i.menu_item_id === menuItemId)?.quantity || 0,
      totalItems: () => get().cart.reduce((s, i) => s + i.quantity, 0),
      subtotal: () => get().cart.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cart: state.cart,
        sessionId: state.sessionId,
        restaurantId: state.restaurantId,
        tableNumber: state.tableNumber,
      }),
    }
  )
);

export default useCartStore;
