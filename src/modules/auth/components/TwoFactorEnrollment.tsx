import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../hooks/useAuth';
import type { BackupCodesSummary, MfaEnrollment } from '../types';

type StatusMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

type PendingAction = 'enroll' | 'verify' | 'disable' | 'generate-codes' | null;

const BACKUP_CODE_BATCH = 10;

const TwoFactorEnrollment = () => {
  const {
    user,
    factors,
    enrollTotp,
    verifyTotpEnrollment,
    disableFactor,
    generateBackupCodes,
    listBackupCodes,
    reauthenticate,
    loading,
  } = useAuth();

  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaStatus, setMfaStatus] = useState<StatusMessage>(null);
  const [backupStatus, setBackupStatus] = useState<StatusMessage>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [backupSummary, setBackupSummary] = useState<BackupCodesSummary | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const totpFactors = useMemo(
    () => factors.filter((factor) => factor.factor_type === 'totp'),
    [factors],
  );

  const hasVerifiedTotp = totpFactors.some((factor) => factor.status === 'verified');
  const isBusy = loading || pendingAction !== null;

  const loadBackupSummary = useCallback(async () => {
    if (!user) {
      return;
    }

    if (!hasVerifiedTotp) {
      setBackupSummary(null);
      return;
    }

    try {
      const summary = await listBackupCodes();
      setBackupSummary(summary);
    } catch (error) {
      setBackupStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to load backup code status.',
      });
    }
  }, [hasVerifiedTotp, listBackupCodes, user]);

  useEffect(() => {
    void loadBackupSummary();
  }, [loadBackupSummary]);

  if (!user) {
    return null;
  }

  const handleEnroll = async () => {
    setMfaStatus(null);
    setPendingAction('enroll');

    try {
      const result = await enrollTotp();
      setEnrollment(result);
    } catch (error) {
      setMfaStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to start enrollment.',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!enrollment) {
      return;
    }

    setPendingAction('verify');
    setMfaStatus(null);

    try {
      await verifyTotpEnrollment(enrollment.factorId, verificationCode);
      setMfaStatus({ type: 'success', message: 'Two-factor authentication is now enabled.' });
      setEnrollment(null);
      setVerificationCode('');
      await loadBackupSummary();
    } catch (error) {
      setMfaStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Verification failed. Try again.',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleDisable = async (factorId: string) => {
    setPendingAction('disable');
    setMfaStatus(null);

    try {
      await disableFactor(factorId);
      setMfaStatus({ type: 'success', message: 'Two-factor authentication has been disabled.' });
      await loadBackupSummary();
    } catch (error) {
      setMfaStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to disable this factor.',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleGenerateCodesRequest = () => {
    setBackupStatus(null);
    setBackupCodes([]);
    setPasswordInput('');
    setPasswordDialogOpen(true);
  };

  const handlePasswordDialogClose = () => {
    if (pendingAction === 'generate-codes') {
      return;
    }

    setPasswordDialogOpen(false);
    setPasswordInput('');
  };

  const handleGenerateCodes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordInput) {
      return;
    }

    setPendingAction('generate-codes');
    setBackupStatus(null);

    try {
      await reauthenticate(passwordInput);
      const result = await generateBackupCodes(BACKUP_CODE_BATCH);
      setBackupCodes(result.codes);
      setBackupSummary(result.summary);
      setBackupStatus({
        type: 'success',
        message: 'New backup codes generated. Store them securely—each code is single-use.',
      });
    } catch (error) {
      setBackupStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to generate backup codes right now. Please try again later.',
      });
    } finally {
      setPendingAction(null);
      setPasswordDialogOpen(false);
      setPasswordInput('');
    }
  };

  const handleRefreshBackupSummary = async () => {
    setBackupStatus(null);
    await loadBackupSummary();
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Secure your account with 2FA</Typography>
        <Typography variant="body2" color="text.secondary">
          Add a TOTP authenticator app (Google Authenticator, 1Password, Authy) to safeguard
          sensitive project and payment activity.
        </Typography>
      </Stack>

      {mfaStatus && (
        <Alert severity={mfaStatus.type} onClose={() => setMfaStatus(null)}>
          {mfaStatus.message}
        </Alert>
      )}

      {totpFactors.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Active authenticators</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {totpFactors.map((factor) => (
              <Chip
                key={factor.id}
                label={factor.friendly_name || `TOTP • ${factor.id.slice(0, 6)}`}
                onDelete={() => handleDisable(factor.id)}
                disabled={isBusy}
                color={factor.status === 'verified' ? 'success' : 'default'}
              />
            ))}
          </Stack>
        </Stack>
      )}

      <Divider flexItem>
        <Typography variant="caption" color="text.secondary">
          {enrollment ? 'Verify 2FA setup' : 'Set up a new authenticator'}
        </Typography>
      </Divider>

      {enrollment ? (
        <Stack component="form" spacing={2} onSubmit={handleVerify}>
          <Typography variant="body2" color="text.secondary">
            Scan the QR code below in your authenticator app, then enter the 6-digit code to
            confirm.
          </Typography>

          <Box
            component="img"
            src={enrollment.qrCode}
            alt="Authenticator QR code"
            sx={{ width: 180, height: 180 }}
          />

          <TextField
            label="Authenticator code"
            inputMode="numeric"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123456"
            fullWidth
            disabled={isBusy}
            autoFocus
          />

          <Button
            type="submit"
            variant="contained"
            disabled={isBusy || verificationCode.length < 6}
          >
            Confirm 2FA setup
          </Button>
        </Stack>
      ) : (
        <Button variant="outlined" onClick={handleEnroll} disabled={isBusy}>
          {totpFactors.length > 0
            ? 'Add another authenticator'
            : 'Enable two-factor authentication'}
        </Button>
      )}

      <Divider flexItem>
        <Typography variant="caption" color="text.secondary">
          Account recovery options
        </Typography>
      </Divider>

      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Backup codes</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate single-use recovery codes to regain access if your authenticator is lost or
            unavailable. Creating a new set invalidates any existing codes.
          </Typography>
        </Stack>

        {backupStatus && (
          <Alert severity={backupStatus.type} onClose={() => setBackupStatus(null)}>
            {backupStatus.message}
          </Alert>
        )}

        {backupSummary && (
          <Typography variant="body2" color="text.secondary">
            Remaining codes: {backupSummary.remaining} of {backupSummary.total}
          </Typography>
        )}

        {backupCodes.length > 0 && (
          <Alert severity="info">
            <AlertTitle>Store these codes securely</AlertTitle>
            <Typography variant="body2" color="text.secondary">
              Save them in a password manager or offline document. Each code works once.
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', pl: 0, mt: 1 }}>
              {backupCodes.map((code) => (
                <Box component="li" key={code}>
                  <Typography variant="body2" fontFamily="monospace">
                    {code}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            onClick={handleGenerateCodesRequest}
            disabled={isBusy || !hasVerifiedTotp}
          >
            {backupSummary?.total ? 'Regenerate backup codes' : 'Generate backup codes'}
          </Button>
          <Button variant="outlined" onClick={handleRefreshBackupSummary} disabled={isBusy}>
            Refresh usage
          </Button>
        </Stack>

        {!hasVerifiedTotp && (
          <Typography variant="caption" color="text.secondary">
            Add and verify an authenticator before generating backup codes.
          </Typography>
        )}
      </Stack>

      <Dialog open={passwordDialogOpen} onClose={handlePasswordDialogClose} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleGenerateCodes}>
          <DialogTitle>Confirm your password</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Generating a new set of codes will invalidate any existing ones. Enter your password
              to confirm this security-sensitive action.
            </Typography>
            <TextField
              label="Password"
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoFocus
              fullWidth
              disabled={pendingAction === 'generate-codes'}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handlePasswordDialogClose}
              disabled={pendingAction === 'generate-codes'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!passwordInput || pendingAction === 'generate-codes'}
            >
              Generate codes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
};

export default TwoFactorEnrollment;
