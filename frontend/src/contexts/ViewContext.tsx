import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * View modes available in the application
 */
export type ViewMode = 'admin' | 'user';

/**
 * User capabilities for determining available views
 */
export interface UserCapabilities {
  isAdmin: boolean;
  isEmployee: boolean;
}

/**
 * View Context value
 */
interface ViewContextValue {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  canAccessAdminView: boolean;
  canAccessUserView: boolean;
  canSwitchViews: boolean;
  capabilities: UserCapabilities;
  setCapabilities: (caps: UserCapabilities) => void;
}

const defaultCapabilities: UserCapabilities = {
  isAdmin: false,
  isEmployee: false,
};

const ViewContext = createContext<ViewContextValue>({
  currentView: 'admin',
  setCurrentView: () => {},
  canAccessAdminView: false,
  canAccessUserView: false,
  canSwitchViews: false,
  capabilities: defaultCapabilities,
  setCapabilities: () => {},
});

/**
 * Determine default view based on user capabilities
 */
function getDefaultView(caps: UserCapabilities): ViewMode {
  // External admin - always admin
  if (caps.isAdmin && !caps.isEmployee) {
    return 'admin';
  }

  // Internal admin - default to admin, can switch
  if (caps.isAdmin && caps.isEmployee) {
    // Check for saved preference
    const savedView = localStorage.getItem('helios_view_preference');
    if (savedView === 'admin' || savedView === 'user') {
      return savedView;
    }
    return 'admin';
  }

  // Regular employee - always user
  if (caps.isEmployee) {
    return 'user';
  }

  // Fallback - admin view (should be unreachable for authenticated users)
  return 'admin';
}

/**
 * View Provider Component
 *
 * Manages the current view (admin vs user) and determines
 * which views are accessible based on user capabilities.
 */
export const ViewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [capabilities, setCapabilitiesState] = useState<UserCapabilities>(defaultCapabilities);
  const [currentView, setCurrentViewState] = useState<ViewMode>('admin');

  // Derived access flags
  const canAccessAdminView = capabilities.isAdmin;
  const canAccessUserView = capabilities.isEmployee;
  const canSwitchViews = capabilities.isAdmin && capabilities.isEmployee;

  /**
   * Set capabilities and update default view
   */
  const setCapabilities = useCallback((caps: UserCapabilities) => {
    setCapabilitiesState(caps);
    const defaultView = getDefaultView(caps);
    setCurrentViewState(defaultView);
  }, []);

  /**
   * Set current view with validation
   */
  const setCurrentView = useCallback((view: ViewMode) => {
    // Validate the view change
    if (view === 'admin' && !canAccessAdminView) {
      console.warn('Cannot switch to admin view - not an admin');
      return;
    }
    if (view === 'user' && !canAccessUserView) {
      console.warn('Cannot switch to user view - not an employee');
      return;
    }

    setCurrentViewState(view);

    // Persist preference for internal admins
    if (canSwitchViews) {
      localStorage.setItem('helios_view_preference', view);
    }
  }, [canAccessAdminView, canAccessUserView, canSwitchViews]);

  // Load capabilities from stored user data on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('helios_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        // Determine capabilities based on user role
        // For now, assume role === 'admin' means isAdmin
        // and all authenticated users are employees (can be refined later)
        const caps: UserCapabilities = {
          isAdmin: user.role === 'admin' || user.role === 'super_admin',
          isEmployee: true, // All org users are employees for now
        };
        setCapabilities(caps);
      } catch (err) {
        console.error('Failed to parse stored user:', err);
      }
    }
  }, [setCapabilities]);

  return (
    <ViewContext.Provider
      value={{
        currentView,
        setCurrentView,
        canAccessAdminView,
        canAccessUserView,
        canSwitchViews,
        capabilities,
        setCapabilities,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
};

/**
 * Hook to access view context
 *
 * Usage:
 * ```tsx
 * const { currentView, setCurrentView, canSwitchViews } = useView();
 *
 * // Switch views (for internal admins)
 * if (canSwitchViews) {
 *   <ViewSwitcher value={currentView} onChange={setCurrentView} />
 * }
 * ```
 */
export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within ViewProvider');
  }
  return context;
};

/**
 * Hook to check if current view is admin
 */
export const useIsAdminView = (): boolean => {
  const { currentView } = useView();
  return currentView === 'admin';
};

/**
 * Hook to check if current view is user
 */
export const useIsUserView = (): boolean => {
  const { currentView } = useView();
  return currentView === 'user';
};
