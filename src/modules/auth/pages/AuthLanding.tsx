import { Paper, Stack, Typography } from '@mui/material';

import LoginForm from '../components/LoginForm';
import RegistrationForm from '../components/RegistrationForm';
import TwoFactorChallenge from '../components/TwoFactorChallenge';
import TwoFactorEnrollment from '../components/TwoFactorEnrollment';
import { useAuth } from '../hooks/useAuth';

const AuthLanding = () => {
  const { user, mfa } = useAuth();

  return (
    <Stack spacing={4} py={{ xs: 4, md: 6 }}>
      <Stack spacing={1} maxWidth={620}>
        <Typography variant="h4">Sign in to WorkDev</Typography>
        <Typography variant="body1" color="text.secondary">
          WorkDev brings together clients and developers to collaborate securely. Choose the
          authentication path that fits your workflow and access the marketplace, projects, and
          workspace hubs.
        </Typography>
      </Stack>

      {mfa && (
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
          <TwoFactorChallenge />
        </Paper>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="stretch">
        <Paper elevation={2} sx={{ p: { xs: 3, md: 4 }, flex: 1 }}>
          <LoginForm />
        </Paper>
        <Paper elevation={2} sx={{ p: { xs: 3, md: 4 }, flex: 1 }}>
          <RegistrationForm />
        </Paper>
      </Stack>

      {user && (
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
          <TwoFactorEnrollment />
        </Paper>
      )}
    </Stack>
  );
};

export default AuthLanding;
