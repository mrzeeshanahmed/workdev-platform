import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import type { NavigationItem } from './navigationConfig';

interface SiteSidebarProps {
  navItems: NavigationItem[];
  open?: boolean;
  onClose?: () => void;
  variant: 'temporary' | 'permanent';
  sidebarWidth: number;
}

const SiteSidebar = ({ navItems, open, onClose, variant, sidebarWidth }: SiteSidebarProps) => {
  const location = useLocation();

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <Box sx={{ px: 3, pb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Navigation
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);

          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={isActive}
              onClick={variant === 'temporary' ? onClose : undefined}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Personalized navigation adapts based on your role.
        </Typography>
      </Box>
    </Box>
  );

  if (variant === 'temporary') {
    return (
      <Drawer
        variant="temporary"
        open={Boolean(open)}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', lg: 'block' },
        '& .MuiDrawer-paper': {
          width: sidebarWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      {content}
    </Drawer>
  );
};

export default SiteSidebar;
