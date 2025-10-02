import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

const NotFound = () => (
  <Box textAlign="center" py={10} display="flex" flexDirection="column" gap={2} alignItems="center">
    <Typography variant="h3" gutterBottom>
      404
    </Typography>
    <Typography variant="body1" color="text.secondary">
      We couldn&apos;t find the page you were looking for.
    </Typography>
    <Button component={Link} to="/" variant="contained" color="primary">
      Back to home
    </Button>
  </Box>
);

export default NotFound;
