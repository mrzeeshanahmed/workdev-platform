import React, { useEffect } from 'react';
import { Box, Card, CardContent, Grid, Typography, Rating, LinearProgress } from '@mui/material';
import { Star, TrendingUp, WorkOutline, Repeat, CheckCircle } from '@mui/icons-material';
import { useClient } from '../context/ClientContext';

interface ClientReputationDashboardProps {
  userId: string;
}

export const ClientReputationDashboard: React.FC<ClientReputationDashboardProps> = ({ userId }) => {
  const { profile, reputationStats, loadClientProfile } = useClient();

  useEffect(() => {
    loadClientProfile(userId);
  }, [userId, loadClientProfile]);

  if (!profile || !reputationStats) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>Loading reputation data...</Typography>
      </Box>
    );
  }

  const getReputationLevel = (rating: number): { label: string; color: string } => {
    if (rating >= 4.5) return { label: 'Excellent', color: '#4caf50' };
    if (rating >= 4.0) return { label: 'Very Good', color: '#8bc34a' };
    if (rating >= 3.5) return { label: 'Good', color: '#ffc107' };
    if (rating >= 3.0) return { label: 'Fair', color: '#ff9800' };
    return { label: 'Needs Improvement', color: '#f44336' };
  };

  const reputationLevel = getReputationLevel(reputationStats.average_rating);

  return (
    <Box>
      {/* Overall Reputation Score */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }} textAlign="center">
              <Typography variant="h2" fontWeight="bold" color="primary">
                {reputationStats.average_rating.toFixed(1)}
              </Typography>
              <Rating
                value={reputationStats.average_rating}
                readOnly
                precision={0.1}
                size="large"
              />
              <Typography variant="h6" color={reputationLevel.color} sx={{ mt: 1 }}>
                {reputationLevel.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on {reputationStats.total_reviews} reviews
              </Typography>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Box mb={2}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Star sx={{ color: '#ffc107', mr: 1 }} />
                  <Typography variant="body2" sx={{ width: '80px' }}>
                    5 stars
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(reputationStats.five_star_count / reputationStats.total_reviews) * 100}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px' }}>
                    {reputationStats.five_star_count}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <Star sx={{ color: '#ffc107', mr: 1 }} />
                  <Typography variant="body2" sx={{ width: '80px' }}>
                    4 stars
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(reputationStats.four_star_count / reputationStats.total_reviews) * 100}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px' }}>
                    {reputationStats.four_star_count}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <Star sx={{ color: '#ffc107', mr: 1 }} />
                  <Typography variant="body2" sx={{ width: '80px' }}>
                    3 stars
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(reputationStats.three_star_count / reputationStats.total_reviews) * 100}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px' }}>
                    {reputationStats.three_star_count}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <Star sx={{ color: '#ffc107', mr: 1 }} />
                  <Typography variant="body2" sx={{ width: '80px' }}>
                    2 stars
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(reputationStats.two_star_count / reputationStats.total_reviews) * 100}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px' }}>
                    {reputationStats.two_star_count}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Star sx={{ color: '#ffc107', mr: 1 }} />
                  <Typography variant="body2" sx={{ width: '80px' }}>
                    1 star
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(reputationStats.one_star_count / reputationStats.total_reviews) * 100}
                    sx={{ flex: 1, mx: 2 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: '40px' }}>
                    {reputationStats.one_star_count}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Rating Breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Rating Breakdown
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {reputationStats.rating_breakdown.communication.toFixed(1)}
                </Typography>
                <Rating
                  value={reputationStats.rating_breakdown.communication}
                  readOnly
                  precision={0.1}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Communication
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {reputationStats.rating_breakdown.professionalism.toFixed(1)}
                </Typography>
                <Rating
                  value={reputationStats.rating_breakdown.professionalism}
                  readOnly
                  precision={0.1}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Professionalism
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {reputationStats.rating_breakdown.project_clarity.toFixed(1)}
                </Typography>
                <Rating
                  value={reputationStats.rating_breakdown.project_clarity}
                  readOnly
                  precision={0.1}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Project Clarity
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary">
                  {reputationStats.rating_breakdown.payment_timeliness.toFixed(1)}
                </Typography>
                <Rating
                  value={reputationStats.rating_breakdown.payment_timeliness}
                  readOnly
                  precision={0.1}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Payment Timeliness
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <WorkOutline color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Projects
                </Typography>
              </Box>
              <Typography variant="h4">{profile.total_projects_posted}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Successful Hires
                </Typography>
              </Box>
              <Typography variant="h4">{profile.successful_hires}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Repeat color="info" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Repeat Hire Rate
                </Typography>
              </Box>
              <Typography variant="h4">{profile.repeat_hire_rate.toFixed(0)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp color="warning" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Avg Project Value
                </Typography>
              </Box>
              <Typography variant="h4">
                ${(reputationStats.average_project_value / 1000).toFixed(1)}k
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
