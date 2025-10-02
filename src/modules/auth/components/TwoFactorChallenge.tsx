import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../hooks/useAuth';

type ChallengeMode = 'totp' | 'backup';

const TwoFactorChallenge = () => {
  const { mfa, challengeTotp, verifyBackupCode, loading, clearError, error } = useAuth();
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState('');
  const [selectedFactor, setSelectedFactor] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [backupCode, setBackupCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);

  useEffect(() => {
    if (mfa) {
      const fallbackFactor = mfa.factorId || mfa.factors[0]?.id || '';
      setSelectedFactor(fallbackFactor);
      setMode('totp');
      setCode('');
      setBackupCode('');
      setPassword('');
      setLocalError(null);
      setBackupError(null);
      clearError();
    }
  }, [clearError, mfa]);

  const factors = useMemo(() => mfa?.factors ?? [], [mfa?.factors]);
  const combinedError = mode === 'backup' ? backupError : localError || error;

  if (!mfa) {
    return null;
  }

  const handleTotpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLocalError(null);
      clearError();
      await challengeTotp(code, selectedFactor || undefined);
    } catch (challengeError) {
      setLocalError(
        challengeError instanceof Error ? challengeError.message : 'Verification failed.',
      );
    }
  };

  const handleBackupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setBackupError(null);
      clearError();
      await verifyBackupCode(backupCode, password);
    } catch (challengeError) {
      setBackupError(
        challengeError instanceof Error
          ? challengeError.message
          : 'Backup code verification failed.',
      );
    }
  };

  const switchMode = (next: ChallengeMode) => {
    setMode(next);
    setCode('');
    setBackupCode('');
    setPassword('');
    setLocalError(null);
    setBackupError(null);
    clearError();
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6">
          {mode === 'backup' ? 'Recover with a backup code' : 'Two-factor authentication required'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {mode === 'backup'
            ? 'Enter one of your saved backup codes and your password to regain access.'
            : 'Enter the 6-digit code from your authenticator app to finish signing in.'}
        </Typography>
      </Stack>

      {combinedError && (
        <Alert
          severity="error"
          onClose={() => {
            setLocalError(null);
            setBackupError(null);
          }}
        >
          {combinedError}
        </Alert>
      )}

      {mode === 'totp' ? (
        <Stack component="form" spacing={2} onSubmit={handleTotpSubmit} noValidate>
          {factors.length > 1 && (
            <TextField
              select
              label="Authentication factor"
              value={selectedFactor}
              onChange={(event) => setSelectedFactor(event.target.value)}
              fullWidth
              disabled={loading}
            >
              {factors.map((factor) => (
                <MenuItem key={factor.id} value={factor.id}>
                  {factor.friendly_name || factor.factor_type.toUpperCase()}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Authentication code"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123456"
            fullWidth
            disabled={loading}
            autoFocus
          />

          <Box display="flex" justifyContent="flex-end">
            <Button type="submit" variant="contained" disabled={loading || code.length < 6}>
              Verify code
            </Button>
          </Box>
        </Stack>
      ) : (
        <Stack component="form" spacing={2} onSubmit={handleBackupSubmit} noValidate>
          <TextField
            label="Backup code"
            value={backupCode}
            onChange={(event) => setBackupCode(event.target.value.trim())}
            placeholder="abcd-efgh"
            fullWidth
            disabled={loading}
            autoFocus
          />
          <TextField
            label="Account password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            fullWidth
            disabled={loading}
          />

          <Box display="flex" justifyContent="flex-end">
            <Button
              type="submit"
              variant="contained"
              disabled={loading || backupCode.length === 0 || password.length === 0}
            >
              Verify backup code
            </Button>
          </Box>
        </Stack>
      )}

      <Box display="flex" justifyContent="flex-end">
        {mode === 'backup' ? (
          <Button variant="text" onClick={() => switchMode('totp')} disabled={loading}>
            Use authenticator code instead
          </Button>
        ) : (
          <Button variant="text" onClick={() => switchMode('backup')} disabled={loading}>
            Use a backup code instead
          </Button>
        )}
      </Box>
    </Stack>
  );
};

export default TwoFactorChallenge;
