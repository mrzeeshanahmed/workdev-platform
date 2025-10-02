import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { PhotoCamera, Save, Cancel } from '@mui/icons-material';
import { useClient } from '../context/ClientContext';
import { COMPANY_SIZES, INDUSTRIES } from '../types';

interface ClientProfileEditorProps {
  userId: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const ClientProfileEditor: React.FC<ClientProfileEditorProps> = ({
  userId,
  onSave,
  onCancel,
}) => {
  const { profile, isLoading, error, updateProfile, uploadLogo, loadClientProfile } = useClient();

  const [formData, setFormData] = useState({
    company_name: '',
    company_website: '',
    company_description: '',
    industry: '',
    company_size: '',
    location: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadClientProfile(userId);
  }, [userId, loadClientProfile]);

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_website: profile.company_website || '',
        company_description: profile.company_description || '',
        industry: profile.industry || '',
        company_size: profile.company_size || '',
        location: profile.location || '',
      });
      setLogoPreview(profile.company_logo_url);
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Upload logo if changed
      if (logoFile) {
        await uploadLogo(userId, logoFile);
      }

      // Update profile
      await updateProfile(userId, formData);

      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Company Profile
        </Typography>

        {(error || saveError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || saveError}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Company Logo */}
          <Grid size={{ xs: 12 }} display="flex" alignItems="center" gap={2}>
            <Avatar
              src={logoPreview || undefined}
              sx={{ width: 100, height: 100 }}
              alt={formData.company_name}
            />
            <Box>
              <input
                accept="image/*"
                id="logo-upload"
                type="file"
                onChange={handleLogoChange}
                hidden
              />
              <label htmlFor="logo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PhotoCamera />}
                  disabled={isSaving}
                >
                  Upload Logo
                </Button>
              </label>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Max size: 2MB. Formats: JPEG, PNG, WebP, SVG
              </Typography>
            </Box>
          </Grid>

          {/* Company Name */}
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              label="Company Name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              disabled={isSaving}
            />
          </Grid>

          {/* Company Website */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Company Website"
              value={formData.company_website}
              onChange={(e) => handleInputChange('company_website', e.target.value)}
              placeholder="https://example.com"
              disabled={isSaving}
            />
          </Grid>

          {/* Location */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="San Francisco, CA"
              disabled={isSaving}
            />
          </Grid>

          {/* Industry */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Industry</InputLabel>
              <Select
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                label="Industry"
                disabled={isSaving}
              >
                <MenuItem value="">
                  <em>Select Industry</em>
                </MenuItem>
                {INDUSTRIES.map((industry) => (
                  <MenuItem key={industry} value={industry}>
                    {industry}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Company Size */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Company Size</InputLabel>
              <Select
                value={formData.company_size}
                onChange={(e) => handleInputChange('company_size', e.target.value)}
                label="Company Size"
                disabled={isSaving}
              >
                <MenuItem value="">
                  <em>Select Size</em>
                </MenuItem>
                {COMPANY_SIZES.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size} employees
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Company Description */}
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              multiline
              rows={4}
              label="Company Description"
              value={formData.company_description}
              onChange={(e) => handleInputChange('company_description', e.target.value)}
              placeholder="Tell developers about your company..."
              disabled={isSaving}
            />
          </Grid>

          {/* Action Buttons */}
          <Grid size={{ xs: 12 }} display="flex" gap={2} justifyContent="flex-end">
            {onCancel && (
              <Button
                variant="outlined"
                onClick={onCancel}
                startIcon={<Cancel />}
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
              disabled={isSaving || !formData.company_name || !formData.company_description}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
