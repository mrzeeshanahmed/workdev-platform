import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useProfile } from '../context/ProfileContext';

export const ProfileCompletenessWidget = () => {
  const { completeness } = useProfile();

  if (!completeness) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const missingItems = [];
  if (!completeness.factors.has_headline) missingItems.push('Professional headline');
  if (!completeness.factors.has_bio) missingItems.push('Bio (500+ characters)');
  if (!completeness.factors.has_profile_picture) missingItems.push('Profile picture');
  if (!completeness.factors.has_skills) missingItems.push('Skills (3+ tags)');
  if (!completeness.factors.has_hourly_rate) missingItems.push('Hourly rate');
  if (!completeness.factors.has_portfolio) missingItems.push('Portfolio projects');
  if (!completeness.factors.has_work_history) missingItems.push('Work history');
  if (!completeness.factors.has_github_sync) missingItems.push('GitHub sync');
  if (!completeness.factors.has_location) missingItems.push('Location');

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Profile Completeness</Typography>
            <Typography variant="h5" color={`${getScoreColor(completeness.score)}.main`}>
              {completeness.score}%
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={completeness.score}
            color={getScoreColor(completeness.score)}
            sx={{ height: 10, borderRadius: 1 }}
          />

          {missingItems.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Complete your profile to increase visibility:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {missingItems.map((item) => (
                  <Chip key={item} label={item} size="small" variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {completeness.score === 100 && (
            <Typography variant="body2" color="success.main" fontWeight="medium">
              🎉 Your profile is complete! Great job!
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
