import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingScreen = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    py={10}
    gap={2}
  >
    <CircularProgress />
    <Typography variant="body2" color="text.secondary">
      Loading WorkDev experience...
    </Typography>
  </Box>
);

export default LoadingScreen;
