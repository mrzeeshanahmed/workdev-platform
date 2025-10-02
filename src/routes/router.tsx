import { lazy, ReactNode, Suspense } from 'react';
import { createBrowserRouter, RouteObject } from 'react-router-dom';

import AppLayout from 'shared/components/AppLayout';
import LoadingScreen from 'shared/components/LoadingScreen';
import NotFound from 'shared/components/NotFound';
import ProtectedRoute from 'modules/auth/components/ProtectedRoute';
import type { RouteConfig } from 'types';

const AuthLanding = lazy(() => import('modules/auth/pages/AuthLanding'));
const DashboardHome = lazy(() => import('modules/dashboard/pages/DashboardHome'));
const ProfileOverview = lazy(() => import('modules/profiles/pages/ProfileOverview'));
const MarketplaceHome = lazy(() => import('modules/marketplace/pages/MarketplaceHome'));
const ProjectsDashboard = lazy(() => import('modules/projects/pages/ProjectsDashboard'));
const WorkspaceHub = lazy(() => import('modules/workspace/pages/WorkspaceHub'));
const VettingOverview = lazy(() => import('modules/vetting/pages/VettingOverview'));
const AccessDenied = lazy(() => import('shared/components/AccessDenied'));

const withSuspense = (node: ReactNode) => <Suspense fallback={<LoadingScreen />}>{node}</Suspense>;

const moduleRoutes: RouteConfig[] = [
  {
    path: '/',
    element: <DashboardHome />,
    module: 'dashboard',
    requiresAuth: true,
  },
  {
    path: '/profiles',
    element: <ProfileOverview />,
    module: 'profiles',
    requiresAuth: true,
  },
  {
    path: '/projects',
    element: <ProjectsDashboard />,
    module: 'projects',
    requiresAuth: true,
    allowedRoles: ['client', 'admin'],
  },
  {
    path: '/workspace',
    element: <WorkspaceHub />,
    module: 'workspace',
    requiresAuth: true,
    allowedRoles: ['developer', 'admin'],
  },
  {
    path: '/marketplace',
    element: <MarketplaceHome />,
    module: 'marketplace',
    requiresAuth: true,
  },
  {
    path: '/vetting',
    element: <VettingOverview />,
    module: 'vetting',
    requiresAuth: true,
    allowedRoles: ['developer', 'admin'],
  },
];

const toRouteObject = (route: RouteConfig): RouteObject => {
  const element = route.requiresAuth ? (
    <ProtectedRoute allowedRoles={route.allowedRoles}>{route.element}</ProtectedRoute>
  ) : (
    route.element
  );
  const normalizedPath = route.path.startsWith('/') ? route.path.slice(1) : route.path;

  if (route.path === '/') {
    return {
      index: true,
      element: withSuspense(element),
    };
  }

  return {
    path: normalizedPath,
    element: withSuspense(element),
  };
};

const routes: RouteObject[] = [
  {
    path: '/auth',
    element: withSuspense(<AuthLanding />),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: moduleRoutes.map(toRouteObject),
  },
  {
    path: '/access-denied',
    element: withSuspense(<AccessDenied />),
  },
  {
    path: '*',
    element: withSuspense(<NotFound />),
  },
];

export const router = createBrowserRouter(routes);
export { moduleRoutes };
