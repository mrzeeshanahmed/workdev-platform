import { useMemo, useState } from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';

import { useAuth } from 'modules/auth/hooks/useAuth';
import type { UserRole } from 'modules/auth/types';

import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';
import SiteSidebar from './SiteSidebar';
import { NAVIGATION_ITEMS, SIDEBAR_WIDTH } from './navigationConfig';

const filterNavigation = (roles: UserRole[] | undefined, userRole: UserRole | undefined) => {
  if (!roles) {
    return true;
  }

  if (!userRole) {
    return false;
  }

  return roles.includes(userRole);
};

const ResponsiveDrawerLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, appUser, signOut, loading } = useAuth();
  const userRole = appUser?.role;
  const displayName = useMemo(
    () => appUser?.display_name || user?.email || 'Account',
    [appUser, user],
  );
  const avatarInitial = useMemo(() => displayName.charAt(0).toUpperCase(), [displayName]);

  const navigation = useMemo(() => {
    return NAVIGATION_ITEMS.filter((item) => filterNavigation(item.roles, userRole));
  }, [userRole]);

  const headerNavigation = useMemo(
    () => navigation.filter((item) => item.showInHeader),
    [navigation],
  );

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <SiteHeader
        navItems={headerNavigation}
        onMenuClick={handleDrawerToggle}
        showMenuButton
        displayName={displayName}
        avatarInitial={avatarInitial}
        onSignOut={handleSignOut}
        loading={loading}
        sidebarWidth={SIDEBAR_WIDTH}
        isAuthenticated={Boolean(user)}
      />
      <SiteSidebar
        navItems={navigation}
        open={mobileOpen}
        onClose={handleDrawerToggle}
        variant="temporary"
        sidebarWidth={SIDEBAR_WIDTH}
      />
      <SiteSidebar navItems={navigation} variant="permanent" sidebarWidth={SIDEBAR_WIDTH} />
      <Box component="main" sx={{ flexGrow: 1, width: { lg: `calc(100% - ${SIDEBAR_WIDTH}px)` } }}>
        <Toolbar />
        <Box
          component="section"
          sx={{
            px: { xs: 2, md: 4 },
            py: { xs: 4, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Box component="div" sx={{ flexGrow: 1 }}>
            <Outlet />
          </Box>
          <SiteFooter />
        </Box>
      </Box>
    </Box>
  );
};

export default ResponsiveDrawerLayout;
