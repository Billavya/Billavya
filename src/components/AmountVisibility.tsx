import React, { createContext, useContext, useState } from "react";

interface AmountVisibilityValue {
  hidden: boolean;
  toggle: () => void;
}

const AmountVisibilityContext = createContext<AmountVisibilityValue | null>(null);

export function useAmountVisibility(): AmountVisibilityValue {
  const ctx = useContext(AmountVisibilityContext);
  if (!ctx) throw new Error("useAmountVisibility must be used within AmountVisibilityProvider");
  return ctx;
}

export function AmountVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Hidden by default, for secrecy at a glance (e.g. glancing at the app in
  // public) — the eye toggle is how a user opts INTO seeing amounts, not out
  // of it. Scoped to amounts only: dates, invoice numbers, tax IDs, etc. are
  // never run through this and always show plainly.
  const [hidden, setHidden] = useState(true);
  return (
    <AmountVisibilityContext.Provider value={{ hidden, toggle: () => setHidden((v) => !v) }}>
      {children}
    </AmountVisibilityContext.Provider>
  );
}
