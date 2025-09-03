"use client";

import { createContext, useContext, useState } from "react";

type CartUI = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CartUIContext = createContext<CartUI>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function CartUIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value: CartUI = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };
  return <CartUIContext.Provider value={value}>{children}</CartUIContext.Provider>;
}

export function useCartUI() {
  return useContext(CartUIContext);
}