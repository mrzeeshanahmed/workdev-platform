import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Autocomplete,
  Slider,
  Stack,
} from '@mui/material';
import { ArrowBack, ArrowForward, CheckCircle, TrendingUp, Code, Timer } from '@mui/icons-material';
import { budgetEstimationService } from '../services/BudgetEstimationService';
import type {
  ProjectDetails,
  ComplexityLevel,
  ProjectType,
  BudgetEstimate,
  BudgetEstimationWizardProps,
} from '../types';
import { BudgetBreakdownChart } from './BudgetBreakdownChart';
import { MarketInsightsPanel } from './MarketInsightsPanel';
import { ConfidenceIntervalDisplay } from './ConfidenceIntervalDisplay';

const COMPLEXITY_OPTIONS: Array<{ value: ComplexityLevel; label: string; description: string }> = [
  {
    value: 'low',
    label: 'Low',
    description: 'Simple features, minimal integrations, standard tech stack',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Moderate features, some integrations, common requirements',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Complex features, multiple integrations, custom solutions',
  },
  {
    value: 'expert',
    label: 'Expert',
    description: 'Highly complex, advanced tech, specialized expertise required',
  },
];

const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: 'web_app', label: 'Web Application' },
  { value: 'mobile_app', label: 'Mobile Application' },
  { value: 'api_backend', label: 'API / Backend Service' },
  { value: 'data_pipeline', label: 'Data Pipeline / ETL' },
  { value: 'ml_model', label: 'Machine Learning Model' },
  { value: 'blockchain', label: 'Blockchain / Smart Contracts' },
  { value: 'integration', label: 'System Integration' },
  { value: 'other', label: 'Other' },
];

const POPULAR_SKILLS = [
  'React',
  'TypeScript',
  'Node.js',
  'Python',
  'PostgreSQL',
  'MongoDB',
  'AWS',
  'Docker',
  'GraphQL',
  'REST API',
  'React Native',
  'Vue.js',
  'Django',
  'FastAPI',
  'Kubernetes',
  'TensorFlow',
  'PyTorch',
  'Solidity',
  'Web3',
  'Redis',
];

const REGIONS = [
  'Global',
  'North America',
  'Europe',
  'Asia Pacific',
  'Latin America',
  'Africa',
  'Middle East',
];

const steps = ['Project Details', 'Technical Requirements', 'Estimation & Review'];

export const BudgetEstimationWizard: React.FC<BudgetEstimationWizardProps> = ({
  onComplete,
  onCancel,
  initialData,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null);

  // Form state
  const [projectDetails, setProjectDetails] = useState<Partial<ProjectDetails>>({
    description: initialData?.description || '',
    required_skills: initialData?.required_skills || [],
    estimated_hours: initialData?.estimated_hours || 160,
    complexity_level: initialData?.complexity_level || 'medium',
    project_type: initialData?.project_type || 'web_app',
    region: initialData?.region || 'Global',
  });

  // Real-time estimation with debounce
  const [estimationDebounce, setEstimationDebounce] = useState<NodeJS.Timeout | null>(null);

  const isFormValid = useCallback((): boolean => {
    return !!(
      projectDetails.description &&
      projectDetails.description.length >= 50 &&
      projectDetails.required_skills &&
      projectDetails.required_skills.length > 0 &&
      projectDetails.estimated_hours &&
      projectDetails.estimated_hours > 0
    );
  }, [projectDetails]);

  const handleEstimate = useCallback(async () => {
    if (!isFormValid()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await budgetEstimationService.estimateBudget(projectDetails as ProjectDetails);
      setEstimate(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get budget estimate';
      setError(errorMessage);
      console.error('Budget estimation error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectDetails, isFormValid]);

  // Auto-estimate when on review step
  useEffect(() => {
    if (activeStep === 2 && !estimate && !loading) {
      handleEstimate();
    }
  }, [activeStep, estimate, loading, handleEstimate]);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      if (estimate) {
        onComplete?.(estimate, projectDetails as ProjectDetails);
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const updateProjectDetail = <K extends keyof ProjectDetails>(
    key: K,
    value: ProjectDetails[K],
  ) => {
    setProjectDetails((prev) => ({ ...prev, [key]: value }));

    // Trigger real-time estimation on review step
    if (activeStep === 2) {
      if (estimationDebounce) clearTimeout(estimationDebounce);
      const timeout = setTimeout(() => {
        handleEstimate();
      }, 1000);
      setEstimationDebounce(timeout);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Tell us about your project
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide details about what you want to build. The more specific you are, the more
              accurate our estimate will be.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={6}
              label="Project Description"
              value={projectDetails.description}
              onChange={(e) => updateProjectDetail('description', e.target.value)}
              placeholder="Describe your project in detail. Include features, functionalities, target users, and any specific requirements..."
              helperText={`${projectDetails.description?.length || 0}/50 minimum characters`}
              error={
                !!projectDetails.description &&
                projectDetails.description.length > 0 &&
                projectDetails.description.length < 50
              }
              sx={{ mb: 3 }}
            />

            <Stack spacing={3}>
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Project Type</InputLabel>
                  <Select
                    value={projectDetails.project_type}
                    onChange={(e) =>
                      updateProjectDetail('project_type', e.target.value as ProjectType)
                    }
                    label="Project Type"
                  >
                    {PROJECT_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth>
                  <InputLabel>Region</InputLabel>
                  <Select
                    value={projectDetails.region}
                    onChange={(e) => updateProjectDetail('region', e.target.value)}
                    label="Region"
                  >
                    {REGIONS.map((region) => (
                      <MenuItem key={region} value={region}>
                        {region}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Project Complexity
                </Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <Box key={option.value} sx={{ minWidth: { xs: '100%', sm: '48%', md: '23%' } }}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: 2,
                          borderColor:
                            projectDetails.complexity_level === option.value
                              ? 'primary.main'
                              : 'divider',
                          '&:hover': {
                            borderColor: 'primary.light',
                          },
                        }}
                        onClick={() => updateProjectDetail('complexity_level', option.value)}
                      >
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {option.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Technical Requirements
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Specify the skills and technologies required for your project.
            </Typography>

            <Autocomplete
              multiple
              freeSolo
              options={POPULAR_SKILLS}
              value={projectDetails.required_skills}
              onChange={(_, newValue) => updateProjectDetail('required_skills', newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip label={option} {...getTagProps({ index })} key={option} icon={<Code />} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Required Skills"
                  placeholder="Add skills..."
                  helperText="Select from common skills or type custom ones"
                />
              )}
              sx={{ mb: 4 }}
            />

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Timer sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="subtitle2">Estimated Hours</Typography>
              </Box>
              <Slider
                value={projectDetails.estimated_hours || 160}
                onChange={(_, value) => updateProjectDetail('estimated_hours', value as number)}
                min={40}
                max={2000}
                step={20}
                marks={[
                  { value: 40, label: '40h' },
                  { value: 500, label: '500h' },
                  { value: 1000, label: '1000h' },
                  { value: 2000, label: '2000h' },
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${value}h`}
              />
              <Typography variant="caption" color="text.secondary">
                Total estimated development hours (≈{' '}
                {Math.round((projectDetails.estimated_hours || 160) / 40)} weeks at 40h/week)
              </Typography>
            </Box>

            <Alert severity="info" icon={<TrendingUp />}>
              <Typography variant="body2">
                💡 <strong>Pro Tip:</strong> Be realistic with your hour estimate. Our AI will
                analyze historical data from similar projects to validate your estimate and provide
                insights.
              </Typography>
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Budget Estimate & Insights
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Here's your AI-powered budget estimate based on historical project data and current
              market rates.
            </Typography>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {estimate && !loading && (
              <Stack spacing={3}>
                <Box>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <CheckCircle sx={{ color: 'success.main', mr: 1 }} />
                        <Typography variant="h5">
                          {'$' + estimate.estimated_budget.toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Budget
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <ConfidenceIntervalDisplay
                        interval={estimate.confidence_interval}
                        estimatedBudget={estimate.estimated_budget}
                      />
                    </CardContent>
                  </Card>
                </Box>

                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                  <Box sx={{ flex: 1 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Budget Breakdown
                        </Typography>
                        <BudgetBreakdownChart
                          breakdown={estimate.budget_breakdown}
                          totalBudget={estimate.estimated_budget}
                        />
                      </CardContent>
                    </Card>
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Market Insights
                        </Typography>
                        <MarketInsightsPanel
                          insights={estimate.market_insights}
                          projectDetails={projectDetails as ProjectDetails}
                        />
                      </CardContent>
                    </Card>
                  </Box>
                </Box>

                {estimate.recommendation && (
                  <Box>
                    <Alert
                      severity={
                        estimate.warning_flags && estimate.warning_flags.length > 0
                          ? 'warning'
                          : 'success'
                      }
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Recommendation
                      </Typography>
                      <Typography variant="body2">{estimate.recommendation}</Typography>
                    </Alert>
                  </Box>
                )}

                {estimate.warning_flags && estimate.warning_flags.length > 0 && (
                  <Box>
                    <Alert severity="warning">
                      <Typography variant="subtitle2" gutterBottom>
                        Important Considerations
                      </Typography>
                      <Box component="ul" sx={{ m: 1, pl: 2.5 }}>
                        {estimate.warning_flags.map((flag, index) => (
                          <li key={index}>
                            <Typography variant="body2">{flag}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Alert>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Budget Estimation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Get an AI-powered budget estimate for your project based on historical data and market rates
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ minHeight: 400, mb: 4 }}>{renderStepContent()}</Box>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleCancel} variant="outlined">
          Cancel
        </Button>
        <Box>
          {activeStep > 0 && (
            <Button onClick={handleBack} startIcon={<ArrowBack />} sx={{ mr: 1 }}>
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={activeStep === 0 ? !isFormValid() : loading}
            endIcon={activeStep === steps.length - 1 ? <CheckCircle /> : <ArrowForward />}
          >
            {activeStep === steps.length - 1 ? 'Complete' : 'Next'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
