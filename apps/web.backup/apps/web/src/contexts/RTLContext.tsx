'use client';

import { createContext, useContext } from 'react';

type Direction = 'ltr' | 'rtl';

interface RTLContextValue {
  direction: Direction;
  isRTL: boolean;
  locale: string;
}

const RTLContext = createContext<RTLContextValue>({
  direction: 'ltr',
  isRTL: false,
  locale: 'en',
});

export function RTLProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const isRTL = ['ar', 'he'].includes(locale);
  const direction: Direction = isRTL ? 'rtl' : 'ltr';

  return (
    <RTLContext.Provider value={{ direction, isRTL, locale }}>
      {children}
    </RTLContext.Provider>
  );
}

export function useRTL() {
  return useContext(RTLContext);
}










