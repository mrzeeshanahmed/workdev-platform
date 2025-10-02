import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import LoadingScreen from 'shared/components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, appUser, initializing, loading } = useAuth();
  const location = useLocation();

  if (initializing || loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = appUser?.role;

    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
