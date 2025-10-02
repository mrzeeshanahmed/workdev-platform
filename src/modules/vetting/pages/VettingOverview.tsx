import { Box, Paper, Typography } from '@mui/material';

const VettingOverview = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Vetting Hub
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review coding assessments, availability, and readiness for new opportunities.
        </Typography>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Coming soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The vetting workflow will centralize assessments, interviews, and approvals.
        </Typography>
      </Paper>
    </Box>
  );
};

export default VettingOverview;
