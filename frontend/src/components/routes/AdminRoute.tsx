import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useView } from '../../contexts/ViewContext';

interface AdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Admin Route Guard
 *
 * Protects routes that should only be accessible to admins.
 * Redirects non-admins to the specified path or home.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  redirectTo = '/',
}) => {
  const { canAccessAdminView } = useView();
  const location = useLocation();

  if (!canAccessAdminView) {
    // Redirect to home, preserving the attempted location for potential redirect after login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
