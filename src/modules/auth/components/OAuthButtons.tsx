import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { useAuth } from '../hooks/useAuth';

type OAuthProviderKey = 'github' | 'google';

const providerLabels: Record<OAuthProviderKey, string> = {
  github: 'Continue with GitHub',
  google: 'Continue with Google',
};

const OAuthButtons = () => {
  const { signInWithGitHub, signInWithGoogle } = useAuth();
  const [activeProvider, setActiveProvider] = useState<OAuthProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderKey | null>(null);
  const [selectedRole, setSelectedRole] = useState<'client' | 'developer' | ''>('');
  const [roleError, setRoleError] = useState<string | null>(null);

  const handleSignIn = async (provider: OAuthProviderKey, role: 'client' | 'developer') => {
    setError(null);
    setActiveProvider(provider);

    try {
      if (provider === 'github') {
        await signInWithGitHub(role);
      } else {
        await signInWithGoogle(role);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'OAuth sign-in failed.');
      setActiveProvider(null);
    }
  };

  const openRoleDialog = (provider: OAuthProviderKey) => {
    setRoleError(null);
    setSelectedRole('');
    setPendingProvider(provider);
    setDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setDialogOpen(false);
    setPendingProvider(null);
    setSelectedRole('');
    setRoleError(null);
  };

  const confirmRoleSelection = async () => {
    if (!pendingProvider) {
      return;
    }

    if (selectedRole !== 'client' && selectedRole !== 'developer') {
      setRoleError('Please choose a role to continue.');
      return;
    }

    setDialogOpen(false);
    await handleSignIn(pendingProvider, selectedRole);
    setPendingProvider(null);
    setSelectedRole('');
  };

  return (
    <Stack spacing={1.5} mt={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {(Object.keys(providerLabels) as OAuthProviderKey[]).map((provider) => (
        <Button
          key={provider}
          variant="outlined"
          color="primary"
          onClick={() => openRoleDialog(provider)}
          disabled={activeProvider !== null}
        >
          {providerLabels[provider]}
        </Button>
      ))}

      <Dialog open={dialogOpen} onClose={closeRoleDialog} aria-labelledby="oauth-role-title">
        <DialogTitle id="oauth-role-title">Choose your role</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Select the role that best describes how you plan to use WorkDev. We'll tailor your
            onboarding experience accordingly.
          </Typography>
          <FormControl component="fieldset" error={Boolean(roleError)} fullWidth>
            <RadioGroup
              value={selectedRole}
              onChange={(event) => {
                setSelectedRole(event.target.value as 'client' | 'developer');
                setRoleError(null);
              }}
            >
              <FormControlLabel value="client" control={<Radio />} label="Client" />
              <FormControlLabel value="developer" control={<Radio />} label="Developer" />
            </RadioGroup>
            {roleError && (
              <Typography variant="caption" color="error" mt={1}>
                {roleError}
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoleDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmRoleSelection} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default OAuthButtons;
