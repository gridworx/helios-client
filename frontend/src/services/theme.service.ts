// Theme Service for managing theme selection

export type ThemeName = 'purple' | 'blue' | 'green' | 'gray';

export interface Theme {
  name: ThemeName;
  displayName: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
}

export const themes: Theme[] = [
  {
    name: 'purple',
    displayName: 'Purple (Default)',
    description: 'Original Helios purple gradient theme',
    primaryColor: '#4f46e5',
    secondaryColor: '#7c3aed'
  },
  {
    name: 'blue',
    displayName: 'Blue',
    description: 'Professional blue theme',
    primaryColor: '#1976d2',
    secondaryColor: '#1565c0'
  },
  {
    name: 'green',
    displayName: 'Green',
    description: 'Fresh green theme',
    primaryColor: '#059669',
    secondaryColor: '#047857'
  },
  {
    name: 'gray',
    displayName: 'Gray',
    description: 'Minimal professional theme',
    primaryColor: '#374151',
    secondaryColor: '#1f2937'
  }
];

class ThemeService {
  private currentTheme: ThemeName = 'purple';

  constructor() {
    // Load theme from environment variable or localStorage
    this.loadTheme();
  }

  private loadTheme(): void {
    try {
      // First check environment variable (if available)
      const envTheme = import.meta.env?.VITE_THEME as ThemeName | undefined;

      // Then check localStorage
      const storedTheme = localStorage.getItem('helios_theme') as ThemeName | null;

      // Priority: env variable > localStorage > default
      if (envTheme && this.isValidTheme(envTheme)) {
        this.currentTheme = envTheme;
      } else if (storedTheme && this.isValidTheme(storedTheme)) {
        this.currentTheme = storedTheme;
      } else {
        this.currentTheme = 'purple';
      }

      this.applyTheme(this.currentTheme);
    } catch (error) {
      console.error('Error loading theme:', error);
      this.currentTheme = 'purple';
      // Try to apply default theme even if there was an error
      this.applyTheme(this.currentTheme);
    }
  }

  private isValidTheme(theme: string): theme is ThemeName {
    return ['purple', 'blue', 'green', 'gray'].includes(theme);
  }

  public setTheme(theme: ThemeName): void {
    // Check if user is admin (extra security check)
    const userStr = localStorage.getItem('helios_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role !== 'admin') {
          console.warn('Only administrators can change themes');
          return;
        }
      } catch (e) {
        console.error('Error parsing user data');
      }
    }

    if (!this.isValidTheme(theme)) {
      console.warn(`Invalid theme: ${theme}. Using default.`);
      theme = 'purple';
    }

    this.currentTheme = theme;
    localStorage.setItem('helios_theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeName): void {
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('data-theme', theme);
      }

      // Also update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      const themeConfig = themes.find(t => t.name === theme);

      if (metaThemeColor && themeConfig) {
        metaThemeColor.setAttribute('content', themeConfig.primaryColor);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }

  public getTheme(): ThemeName {
    return this.currentTheme;
  }

  public getThemeConfig(): Theme | undefined {
    return themes.find(t => t.name === this.currentTheme);
  }

  public getAllThemes(): Theme[] {
    return themes;
  }

  // Initialize theme on app load
  public init(): void {
    this.loadTheme();
  }
}

export const themeService = new ThemeService();