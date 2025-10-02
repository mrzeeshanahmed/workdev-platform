import { Box, Paper, Typography } from '@mui/material';

const stats = [
  { label: 'Active projects', value: '3' },
  { label: 'Open proposals', value: '8' },
  { label: 'Unread messages', value: '5' },
];

const DashboardHome = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Welcome back
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your projects, collaboration spaces, and marketplace activity from one place.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {stats.map((stat) => (
          <Paper key={stat.label} sx={{ p: 3 }}>
            <Typography variant="h6">{stat.value}</Typography>
            <Typography variant="body2" color="text.secondary">
              {stat.label}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default DashboardHome;
