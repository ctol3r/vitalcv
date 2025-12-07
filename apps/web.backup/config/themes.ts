export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  logos: {
    light: string;
    dark: string;
    favicon: string;
  };
  login: {
    backgroundUrl: string;
    title: string;
    subtitle: string;
  };
  dashboard: {
    headerColor: string;
    sidebarColor: string;
  };
}

export const defaultTheme: ThemeConfig = {
  colors: {
    primary: '#0070f3',
    secondary: '#1c1c1e',
    accent: '#79ffe1',
    background: '#ffffff',
    foreground: '#000000',
  },
  logos: {
    light: '/logo-light.png',
    dark: '/logo-dark.png',
    favicon: '/favicon.ico',
  },
  login: {
    backgroundUrl: '/login-bg.jpg',
    title: 'Welcome Back',
    subtitle: 'Sign in to your account',
  },
  dashboard: {
    headerColor: '#ffffff',
    sidebarColor: '#f5f5f5',
  },
};

export const themes: Record<string, ThemeConfig> = {
  default: defaultTheme,
  // Example tenant theme
  demo: {
    ...defaultTheme,
    colors: {
      ...defaultTheme.colors,
      primary: '#ff0080', // Pink for demo
    },
    login: {
      ...defaultTheme.login,
      title: 'Demo Portal',
    },
  },
};

export function getTheme(tenantSlug: string): ThemeConfig {
  return themes[tenantSlug] || defaultTheme;
}















