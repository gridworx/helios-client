import { useState, useEffect } from 'react';
import { themeService, ThemeName } from '../services/theme.service';
import './ThemeSelector.css';

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('purple');
  const [themes, setThemes] = useState(themeService.getAllThemes());

  useEffect(() => {
    // Initialize theme after component mounts
    const theme = themeService.getTheme();
    setCurrentTheme(theme);
  }, []);

  const handleThemeChange = (theme: ThemeName) => {
    themeService.setTheme(theme);
    setCurrentTheme(theme);
  };

  return (
    <div className="theme-selector">
      <h3>Theme Preferences</h3>
      <p className="theme-description">
        Choose a color theme that suits your preference. The selected theme will be saved and applied across all pages.
      </p>

      <div className="theme-grid">
        {themes.map((theme) => (
          <div
            key={theme.name}
            className={`theme-card ${currentTheme === theme.name ? 'active' : ''}`}
            onClick={() => handleThemeChange(theme.name)}
          >
            <div
              className="theme-preview"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`
              }}
            />
            <div className="theme-info">
              <h4>{theme.displayName}</h4>
              <p>{theme.description}</p>
            </div>
            {currentTheme === theme.name && (
              <div className="theme-selected">
                ✓ Active
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="theme-note">
        <span className="info-icon">ℹ️</span>
        <span>
          You can also set a default theme using the <code>VITE_THEME</code> environment variable.
        </span>
      </div>
    </div>
  );
}