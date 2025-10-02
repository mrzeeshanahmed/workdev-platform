import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

interface RegistrationFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  role: 'client' | 'developer' | '';
  agreedToTerms: boolean;
}

const passwordPolicy =
  'Password must be at least 8 characters and include upper, lower, and numeric characters.';

const steps = ['Account details', 'Role & agreements'];

const onboardingPathForRole = (role: 'client' | 'developer'): string => {
  return role === 'client' ? '/projects' : '/workspace';
};

const RegistrationForm = () => {
  const { signUp, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    trigger,
  } = useForm<RegistrationFormValues>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
      agreedToTerms: false,
    },
  });

  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const combinedError = useMemo(() => localError || error, [error, localError]);
  const passwordValue = watch('password');

  const advanceToRoleSelection = async () => {
    const isValid = await trigger(['email', 'password', 'confirmPassword']);

    if (!isValid) {
      return;
    }

    setActiveStep(1);
  };

  const goBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = handleSubmit(async (values) => {
    setLocalError(null);
    setSuccessMessage(null);

    if (values.role !== 'client' && values.role !== 'developer') {
      setLocalError('Please select a valid role.');
      return;
    }

    try {
      const result = await signUp(values.email, values.password, values.role);

      if (result.needsConfirmation) {
        setSuccessMessage('Account created. Check your inbox to confirm your email.');
      } else {
        setSuccessMessage('Account created successfully. Redirecting you to onboarding...');
        navigate(onboardingPathForRole(values.role));
      }

      reset({
        email: '',
        password: '',
        confirmPassword: '',
        role: values.role,
        agreedToTerms: false,
      });
      setActiveStep(0);
    } catch (authError) {
      setLocalError(
        authError instanceof Error ? authError.message : 'Unable to complete registration.',
      );
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
    validate: (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value) || passwordPolicy,
    onChange: () => {
      setLocalError(null);
      if (error) {
        clearError();
      }
    },
  });

  const registerConfirmPassword = register('confirmPassword', {
    required: 'Confirm your password.',
    validate: (value) => value === passwordValue || 'Passwords do not match.',
  });

  return (
    <Stack component="form" spacing={3} onSubmit={onSubmit} noValidate>
      <Stack spacing={0.5}>
        <Typography variant="h5">Create your WorkDev account</Typography>
        <Typography variant="body2" color="text.secondary">
          We’ll tailor onboarding based on your role, so let’s start with a few essentials.
        </Typography>
      </Stack>

      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {combinedError && (
        <Alert severity="error" onClose={() => setLocalError(null)}>
          {combinedError}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {activeStep === 0 && (
        <Stack spacing={2}>
          <TextField
            label="Work email"
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
            autoComplete="new-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message ?? passwordPolicy}
            disabled={loading}
            {...registerPassword}
          />

          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            disabled={loading}
            {...registerConfirmPassword}
          />
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2}>
          <FormControl component="fieldset" error={Boolean(errors.role)} disabled={loading}>
            <FormLabel component="legend">Select your primary role</FormLabel>
            <Controller
              name="role"
              control={control}
              rules={{ required: 'Please choose a role.' }}
              render={({ field }) => (
                <RadioGroup {...field}>
                  <FormControlLabel
                    value="client"
                    control={<Radio />}
                    label="Client — I’m looking to hire or manage projects"
                  />
                  <FormControlLabel
                    value="developer"
                    control={<Radio />}
                    label="Developer — I’m ready to collaborate or join projects"
                  />
                </RadioGroup>
              )}
            />
            {errors.role && <FormHelperText>{errors.role.message}</FormHelperText>}
          </FormControl>

          <Box>
            <Controller
              name="agreedToTerms"
              control={control}
              rules={{ required: 'You must accept the terms to continue.' }}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label={
                    <Typography variant="body2" color="text.secondary">
                      I agree to the WorkDev Terms of Service and Privacy Policy.
                    </Typography>
                  }
                />
              )}
            />
            {errors.agreedToTerms && (
              <FormHelperText error>{errors.agreedToTerms.message}</FormHelperText>
            )}
          </Box>
        </Stack>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        {activeStep > 0 && (
          <Button onClick={goBack} variant="text" disabled={loading}>
            Back
          </Button>
        )}

        {activeStep === 0 && (
          <Button onClick={advanceToRoleSelection} variant="contained" disabled={loading}>
            Continue
          </Button>
        )}

        {activeStep === 1 && (
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            Create account
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default RegistrationForm;
