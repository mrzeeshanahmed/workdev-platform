import MenuIcon from '@mui/icons-material/Menu';
import { AppBar, Avatar, Box, Button, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import { Link, NavLink } from 'react-router-dom';
import type { NavigationItem } from './navigationConfig';

interface SiteHeaderProps {
  navItems: NavigationItem[];
  onMenuClick: () => void;
  showMenuButton: boolean;
  displayName: string;
  avatarInitial: string;
  onSignOut: () => void;
  loading: boolean;
  sidebarWidth: number;
  isAuthenticated: boolean;
}

const SiteHeader = ({
  navItems,
  onMenuClick,
  showMenuButton,
  displayName,
  avatarInitial,
  onSignOut,
  loading,
  sidebarWidth,
  isAuthenticated,
}: SiteHeaderProps) => {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        width: { lg: `calc(100% - ${sidebarWidth}px)` },
        ml: { lg: `${sidebarWidth}px` },
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {showMenuButton && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
            sx={{ mr: 1, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ textDecoration: 'none', color: 'text.primary', fontWeight: 600 }}
        >
          WorkDev Platform
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={NavLink}
              to={item.path}
              end={item.path === '/'}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                color: 'text.secondary',
                '&.active': {
                  color: 'primary.main',
                  fontWeight: 600,
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
        {isAuthenticated ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>{avatarInitial}</Avatar>
            <Typography variant="body2" color="text.primary">
              {displayName}
            </Typography>
            <Button variant="outlined" size="small" onClick={onSignOut} disabled={loading}>
              Sign out
            </Button>
          </Stack>
        ) : (
          <Button component={Link} to="/auth" variant="contained" size="small">
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default SiteHeader;
