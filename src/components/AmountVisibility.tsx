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
  const [hidden, setHidden] = useState(false);
  return (
    <AmountVisibilityContext.Provider value={{ hidden, toggle: () => setHidden((v) => !v) }}>
      {children}
    </AmountVisibilityContext.Provider>
  );
}
