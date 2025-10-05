import { useState, useRef, useEffect } from 'react';
import './ClientUserMenu.css';

interface ClientUserMenuProps {
  userName: string;
  userEmail: string;
  userRole: string;
  onLogout: () => void;
  onChangePassword?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAdministrators?: () => void;
}

export function ClientUserMenu({ userName, userEmail, userRole, onLogout, onChangePassword, onNavigateToSettings, onNavigateToAdministrators }: ClientUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = () => {
    if (confirm('Are you sure you want to sign out?')) {
      onLogout();
    }
  };

  const getInitials = () => {
    const parts = userName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="client-user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        <div className="user-avatar">{getInitials()}</div>
        <span className="menu-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-avatar-large">{getInitials()}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-email">{userEmail}</div>
              <div className="user-role">{userRole}</div>
            </div>
          </div>

          <div className="menu-divider"></div>

          <div className="menu-items">
            <button className="menu-item" onClick={() => {
              setIsOpen(false);
              if (onChangePassword) {
                onChangePassword();
              } else if (onNavigateToSettings) {
                onNavigateToSettings();
              }
            }}>
              <span className="menu-icon">🔑</span>
              <span>Change Password</span>
            </button>
            <button className="menu-item" onClick={() => {
              setIsOpen(false);
              if (onNavigateToAdministrators) {
                onNavigateToAdministrators();
              }
            }}>
              <span className="menu-icon">👥</span>
              <span>Administrators</span>
            </button>
            <button className="menu-item" onClick={() => alert('API Keys coming soon!')}>
              <span className="menu-icon">🔐</span>
              <span>My API Keys</span>
            </button>
            <button className="menu-item" onClick={() => {
              setIsOpen(false);
              if (onNavigateToSettings) {
                onNavigateToSettings();
              } else {
                alert('Settings coming soon!');
              }
            }}>
              <span className="menu-icon">⚙️</span>
              <span>Settings</span>
            </button>
          </div>

          <div className="menu-divider"></div>

          <div className="menu-items">
            <button className="menu-item danger" onClick={handleLogout}>
              <span className="menu-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>

          <div className="menu-footer">
            <div className="footer-text">
              🔒 Secure administrative access
            </div>
          </div>
        </div>
      )}
    </div>
  );
}