import { Box, Container, Typography } from '@mui/material';

const SiteFooter = () => {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', mt: 'auto' }}>
      <Container
        maxWidth="xl"
        sx={{ py: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} WorkDev. All rights reserved.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Built for clients and developers worldwide.
        </Typography>
      </Container>
    </Box>
  );
};

export default SiteFooter;
