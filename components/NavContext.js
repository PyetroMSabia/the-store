"use client";

import { createContext, useContext, useState } from "react";

const NavContext = createContext({ open: false, setOpen: () => {} });

export function NavProvider({ children }) {
  const [open, setOpen] = useState(false);
  return <NavContext.Provider value={{ open, setOpen }}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);
