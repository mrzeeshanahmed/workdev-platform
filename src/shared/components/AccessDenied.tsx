import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const AccessDenied = () => {
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h4" gutterBottom>
        Access Restricted
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        You do not have permission to view this area. If you believe this is a mistake, contact
        support.
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Return to dashboard
      </Button>
    </Box>
  );
};

export default AccessDenied;
