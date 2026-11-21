"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  addCartItem,
  CART_STORAGE_KEY,
  cartCount,
  readCart,
  removeCartItem,
  setCartQuantity,
  writeCart,
  type CartItem,
} from "@/lib/cart";

import { useToast } from "./toast";

/**
 * Client-side cart state.
 *
 * This is deliberately non-authoritative: it only remembers variant ids,
 * quantities and a display snapshot so browsing feels immediate. Checkout
 * (Level 8) will re-read every variant from the database before accepting an
 * order.
 *
 * localStorage is an external store, so `useSyncExternalStore` is used instead
 * of an effect that sets state. React renders the server snapshot during
 * hydration and swaps to the stored cart afterwards, avoiding a mismatch.
 */
interface CartContextValue {
  items: readonly CartItem[];
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const SERVER_ITEMS: CartItem[] = [];

let items: CartItem[] = SERVER_ITEMS;
let loaded = false;
const listeners = new Set<() => void>();

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked entirely in privacy modes.
    return null;
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  items = readCart(browserStorage());
  loaded = true;
}

function commit(next: CartItem[]): void {
  if (next === items) return;
  items = next;
  writeCart(browserStorage(), items);
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== CART_STORAGE_KEY) return;
  items = readCart(browserStorage());
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function getSnapshot(): CartItem[] {
  ensureLoaded();
  return items;
}

function getServerSnapshot(): CartItem[] {
  return SERVER_ITEMS;
}

function updateItems(updater: (current: CartItem[]) => CartItem[]): void {
  ensureLoaded();
  commit(updater(items));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const cartItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);
  const { showToast } = useToast();

  const addItem = useCallback(
    (item: CartItem) => {
      updateItems((current) => addCartItem(current, item));
      showToast(`Added “${item.display.name}” to your cart`);
    },
    [showToast],
  );

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    updateItems((current) => setCartQuantity(current, variantId, quantity));
  }, []);

  const removeItem = useCallback(
    (variantId: string) => {
      updateItems((current) => removeCartItem(current, variantId));
      showToast("Item removed from your cart", "info");
    },
    [showToast],
  );

  const clear = useCallback(() => updateItems(() => []), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: cartItems,
      count: cartCount(cartItems),
      isOpen,
      openCart,
      closeCart,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [cartItems, isOpen, openCart, closeCart, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>.");
  return context;
}
