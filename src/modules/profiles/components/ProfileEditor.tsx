import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import type { ProfileUpdatePayload } from '../types';
import { SkillsAutocomplete } from './index';

export const ProfileEditor = () => {
  const {
    profile,
    completeness,
    loading,
    error,
    updateProfile,
    uploadProfilePicture,
    syncGitHub,
    clearError,
  } = useProfile();

  const [formData, setFormData] = useState<ProfileUpdatePayload>({
    headline: profile?.headline ?? '',
    bio: profile?.bio ?? '',
    hourly_rate: profile?.hourly_rate ?? undefined,
    currency: profile?.currency ?? 'USD',
    availability_status: profile?.availability_status ?? 'available',
    years_of_experience: profile?.years_of_experience ?? undefined,
    location: profile?.location ?? '',
    skills: profile?.skills ?? [],
  });

  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleChange = (field: keyof ProfileUpdatePayload) => (value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(formData);
    } catch (error) {
      // Error handled by context
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadProfilePicture(file);
    } catch (error) {
      // Error handled by context
    } finally {
      setUploading(false);
    }
  };

  const handleGitHubSync = async () => {
    setSyncing(true);
    try {
      await syncGitHub();
    } catch (error) {
      // Error handled by context
    } finally {
      setSyncing(false);
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {/* Profile Completeness */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Profile Strength</Typography>
              <Typography variant="h6" color="primary">
                {completeness?.score ?? 0}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={completeness?.score ?? 0}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {completeness?.factors && (
                <>
                  {!completeness.factors.has_headline && (
                    <Chip label="Add headline" size="small" variant="outlined" />
                  )}
                  {!completeness.factors.has_bio && (
                    <Chip label="Add bio" size="small" variant="outlined" />
                  )}
                  {!completeness.factors.has_skills && (
                    <Chip label="Add skills" size="small" variant="outlined" />
                  )}
                  {!completeness.factors.has_portfolio && (
                    <Chip label="Add portfolio" size="small" variant="outlined" />
                  )}
                  {!completeness.factors.has_github_sync && (
                    <Chip label="Sync GitHub" size="small" variant="outlined" />
                  )}
                </>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Profile Picture */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Profile Picture</Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                src={profile.profile_picture_url ?? undefined}
                sx={{ width: 100, height: 100 }}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={uploading || loading}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                />
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Max file size: 2MB. Formats: JPEG, PNG, WebP
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Basic Info Form */}
      <Card>
        <CardContent>
          <Stack component="form" spacing={3} onSubmit={handleSubmit}>
            <Typography variant="h6">Basic Information</Typography>

            <TextField
              label="Professional Headline"
              value={formData.headline}
              onChange={(e) => handleChange('headline')(e.target.value)}
              placeholder="e.g., Full-Stack Developer | React & Node.js Expert"
              fullWidth
              required
              helperText="A catchy one-liner that describes your expertise"
            />

            <TextField
              label="Bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio')(e.target.value)}
              multiline
              rows={6}
              placeholder="Tell clients about your experience, specializations, and what makes you unique..."
              fullWidth
              required
              helperText={`${formData.bio?.length ?? 0} / 500 characters minimum`}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Hourly Rate"
                  type="number"
                  value={formData.hourly_rate ?? ''}
                  onChange={(e) => handleChange('hourly_rate')(parseFloat(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/hr</InputAdornment>,
                  }}
                  fullWidth
                  required
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={formData.currency}
                    onChange={(e) => handleChange('currency')(e.target.value)}
                    label="Currency"
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                    <MenuItem value="CAD">CAD</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Availability</InputLabel>
                  <Select
                    value={formData.availability_status}
                    onChange={(e) => handleChange('availability_status')(e.target.value)}
                    label="Availability"
                  >
                    <MenuItem value="available">Available Now</MenuItem>
                    <MenuItem value="booked">Currently Booked</MenuItem>
                    <MenuItem value="unavailable">Not Available</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Years of Experience"
                  type="number"
                  value={formData.years_of_experience ?? ''}
                  onChange={(e) => handleChange('years_of_experience')(parseInt(e.target.value))}
                  fullWidth
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Location"
                  value={formData.location}
                  onChange={(e) => handleChange('location')(e.target.value)}
                  placeholder="e.g., San Francisco, CA or Remote"
                  fullWidth
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Skills
              </Typography>
              <SkillsAutocomplete value={formData.skills ?? []} onChange={handleChange('skills')} />
              <FormHelperText>Add at least 3 relevant skills</FormHelperText>
            </Box>

            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleGitHubSync} startIcon={<RefreshIcon />}>
                {syncing ? 'Syncing...' : 'Sync GitHub'}
              </Button>
              <Button type="submit" variant="contained" disabled={loading} startIcon={<SaveIcon />}>
                Save Changes
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
