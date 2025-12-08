import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useView } from '../../contexts/ViewContext';

interface EmployeeRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Employee Route Guard
 *
 * Protects routes that should only be accessible to employees.
 * Redirects non-employees (external admins) to the specified path or admin dashboard.
 */
export const EmployeeRoute: React.FC<EmployeeRouteProps> = ({
  children,
  redirectTo = '/admin',
}) => {
  const { canAccessUserView } = useView();
  const location = useLocation();

  if (!canAccessUserView) {
    // Redirect to admin, preserving the attempted location
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default EmployeeRoute;
