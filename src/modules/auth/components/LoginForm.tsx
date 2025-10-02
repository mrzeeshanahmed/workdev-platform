import { Alert, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAuth } from '../hooks/useAuth';
import OAuthButtons from './OAuthButtons';

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginForm = () => {
  const { signIn, loading, error, clearError, mfa } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const [localError, setLocalError] = useState<string | null>(null);
  const combinedError = useMemo(() => localError || error, [error, localError]);

  const onSubmit = handleSubmit(async (values) => {
    setLocalError(null);

    try {
      await signIn(values.email, values.password);
    } catch (authError) {
      setLocalError(authError instanceof Error ? authError.message : 'Unable to sign in.');
    }
  });

  const registerEmail = register('email', {
    required: 'Email is required.',
    pattern: {
      value: /.+@.+\..+/,
      message: 'Enter a valid email address.',
    },
    onChange: () => {
      setLocalError(null);
      if (error) {
        clearError();
      }
    },
  });

  const registerPassword = register('password', {
    required: 'Password is required.',
    minLength: {
      value: 8,
      message: 'Passwords must be at least 8 characters.',
    },
    onChange: () => {
      setLocalError(null);
      if (error) {
        clearError();
      }
    },
  });

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
      <Stack spacing={0.5}>
        <Typography variant="h5">Welcome back</Typography>
        <Typography variant="body2" color="text.secondary">
          Sign in with your email and password or choose a social provider.
        </Typography>
      </Stack>

      {combinedError && !mfa && (
        <Alert severity="error" onClose={() => setLocalError(null)}>
          {combinedError}
        </Alert>
      )}

      <TextField
        label="Email"
        type="email"
        fullWidth
        autoComplete="email"
        error={Boolean(errors.email)}
        helperText={errors.email?.message}
        disabled={loading}
        {...registerEmail}
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        autoComplete="current-password"
        error={Boolean(errors.password)}
        helperText={errors.password?.message}
        disabled={loading}
        {...registerPassword}
      />

      <Button type="submit" variant="contained" size="large" disabled={loading}>
        Sign in
      </Button>

      <Divider>or</Divider>

      <OAuthButtons />
    </Stack>
  );
};

export default LoginForm;
