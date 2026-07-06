import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'megasub_theme';

export const LIGHT_COLORS = {
  mode: 'light',
  background: '#F7F8FC',
  card: '#FFFFFF',
  cardAlt: 'rgba(74,85,221,0.06)',
  border: '#ECEDF6',
  text: '#0B0D1A',
  textMuted: 'rgba(11,13,26,0.5)',
  textFaint: 'rgba(11,13,26,0.4)',
  divider: 'rgba(11,13,26,0.06)',
  brand: '#4A55DD',
  statusBarStyle: 'dark-content',
};

export const DARK_COLORS = {
  mode: 'dark',
  background: '#0B0D1A',
  card: '#161826',
  cardAlt: 'rgba(108,118,245,0.14)',
  border: '#262943',
  text: '#F5F6FA',
  textMuted: 'rgba(245,246,250,0.55)',
  textFaint: 'rgba(245,246,250,0.4)',
  divider: 'rgba(245,246,250,0.08)',
  brand: '#6C76F5',
  statusBarStyle: 'light-content',
};

const ThemeContext = createContext({
  colors: LIGHT_COLORS,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark') setIsDark(true);
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      SecureStore.setItemAsync(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
