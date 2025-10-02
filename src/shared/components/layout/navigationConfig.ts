import type { UserRole } from 'modules/auth/types';

export interface NavigationItem {
  label: string;
  path: string;
  roles?: UserRole[];
  showInHeader?: boolean;
}

export const SIDEBAR_WIDTH = 280;

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    showInHeader: true,
  },
  {
    label: 'Marketplace',
    path: '/marketplace',
    showInHeader: true,
  },
  {
    label: 'Projects',
    path: '/projects',
    roles: ['client', 'admin'],
    showInHeader: true,
  },
  {
    label: 'Workspace',
    path: '/workspace',
    roles: ['developer', 'admin'],
    showInHeader: true,
  },
  {
    label: 'Profiles',
    path: '/profiles',
    showInHeader: false,
  },
  {
    label: 'Vetting',
    path: '/vetting',
    roles: ['developer', 'admin'],
    showInHeader: false,
  },
];
