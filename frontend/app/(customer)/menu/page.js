'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, X, ShoppingCart, UtensilsCrossed, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { menuApi, restaurantApi } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import useCartStore from '@/store/cartStore';
import ItemCard from '@/components/menu/ItemCard';
import CategoryFilter from '@/components/menu/CategoryFilter';
import FloatingCart from '@/components/cart/FloatingCart';

export default function MenuPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rid = searchParams.get('rid');
  const table = searchParams.get('table');
  const sid = searchParams.get('sid');

  const { cart, setCart, sessionId, setSession, addItem, removeItem, getItemQty } = useCartStore();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Apply branding
  useEffect(() => {
    if (restaurant?.theme_color) {
      document.documentElement.style.setProperty('--brand-color', restaurant.theme_color);
    }
  }, [restaurant?.theme_color]);

  // Load data
  useEffect(() => {
    if (!rid) return;
    const load = async () => {
      try {
        const [restRes, menuRes] = await Promise.all([
          restaurantApi.getPublic(rid),
          menuApi.getAll(rid),
        ]);
        setRestaurant(restRes.data.restaurant);
        setMenuItems(menuRes.data.items);
        setCategories(['All', ...menuRes.data.categories]);
      } catch (err) {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rid]);

  // Socket connection + shared cart sync
  useEffect(() => {
    if (!sid) return;
    if (sid !== sessionId) setSession(sid, rid, table);
    const socket = connectSocket();

    socket.emit('join-session', { session_id: sid, user_name: 'Guest' });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('cart-updated', (data) => {
      setCart(data.cart);
    });
    socket.on('menu-availability-changed', ({ item_id, is_available }) => {
      setMenuItems(prev => prev.map(i => i._id === item_id ? { ...i, is_available } : i));
    });

    return () => {
      socket.off('cart-updated');
      socket.off('menu-availability-changed');
    };
  }, [sid, rid, table, sessionId, setSession, setCart]);

  // Sync cart to server via socket
  const syncCart = useCallback((newCart) => {
    if (!sid) return;
    const socket = connectSocket();
    socket.emit('cart-update', { session_id: sid, cart: newCart });
  }, [sid]);

  const handleAdd = useCallback((item) => {
    addItem({ menu_item_id: item._id, name: item.name, price: item.price, type: item.type, image: item.image, category: item.category });
    // Get updated cart from store and sync
    setTimeout(() => {
      const updatedCart = useCartStore.getState().cart;
      syncCart(updatedCart);
    }, 0);
  }, [addItem, syncCart]);

  const handleRemove = useCallback((item) => {
    removeItem(item._id);
    setTimeout(() => {
      const updatedCart = useCartStore.getState().cart;
      syncCart(updatedCart);
    }, 0);
  }, [removeItem, syncCart]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = menuItems.filter(i => i.is_available);
    if (activeCategory !== 'All') items = items.filter(i => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return items;
  }, [menuItems, activeCategory, search]);

  const brand = restaurant?.theme_color || '#e85d04';
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}99)` }}>
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <p className="text-[#a1a1aa] animate-pulse">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {restaurant?.logo ? (
              <img src={restaurant.logo} alt={restaurant.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
                <UtensilsCrossed size={18} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-white font-display truncate">{restaurant?.name}</h1>
              <p className="text-xs text-[#71717a]">Table {table}</p>
            </div>
            <div className="flex items-center gap-1">
              {connected
                ? <Wifi size={14} className="text-blue-400" />
                : <WifiOff size={14} className="text-slate-400" />}
              <span className="text-xs text-[#71717a] hidden sm:block">{connected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {/* Search */}
        <div className="relative mt-4 mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            placeholder="Search dishes..."
            className="input pl-10 pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
              onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <CategoryFilter
          categories={categories}
          active={activeCategory}
          onChange={setActiveCategory}
          brandColor={brand}
        />

        {/* Items */}
        <div className="mt-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 text-[#71717a]"
              >
                <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-40" />
                <p>No items found</p>
                {search && <button className="text-sm mt-2 underline" onClick={() => setSearch('')}>Clear search</button>}
              </motion.div>
            ) : (
              filteredItems.map((item, i) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ItemCard
                    item={item}
                    qty={getItemQty(item._id)}
                    onAdd={() => handleAdd(item)}
                    onRemove={() => handleRemove(item)}
                    brandColor={brand}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Cart */}
      {totalItems > 0 && (
        <FloatingCart
          totalItems={totalItems}
          totalPrice={totalPrice}
          brandColor={brand}
          onClick={() => router.push(`/cart?rid=${rid}&table=${table}&sid=${sid}`)}
        />
      )}
    </div>
  );
}
