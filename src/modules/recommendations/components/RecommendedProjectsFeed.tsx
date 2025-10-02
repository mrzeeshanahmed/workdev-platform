/**
 * Recommended Projects Feed Component
 * Displays personalized project recommendations for developers
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Skeleton,
  Alert,
  Tooltip,
  IconButton,
  Stack,
  Rating,
  Grid,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { recommendationService } from 'modules/recommendations';
import type { ProjectRecommendation } from 'modules/recommendations/types';
import { useAuth } from 'modules/auth';

interface RecommendedProjectsFeedProps {
  limit?: number;
  showExplanations?: boolean;
  onProjectClick?: (projectId: string) => void;
  onApply?: (projectId: string) => void;
}

export const RecommendedProjectsFeed: React.FC<RecommendedProjectsFeedProps> = ({
  limit = 10,
  showExplanations = true,
  onProjectClick,
  onApply,
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<ProjectRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, limit]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const recs = await recommendationService.getProjectRecommendations(user!.id, {
        limit,
        refresh: false,
      });

      setRecommendations(recs);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectView = async (recommendation: ProjectRecommendation) => {
    // Track view interaction
    await recommendationService.markAsViewed(recommendation.recommendation_id, 'project');

    // Trigger callback
    if (onProjectClick) {
      onProjectClick(recommendation.project_id);
    }
  };

  const handleDismiss = async (recommendation: ProjectRecommendation, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      await recommendationService.dismissRecommendation(
        recommendation.recommendation_id,
        'project',
      );

      setDismissedIds((prev) => new Set(prev).add(recommendation.recommendation_id));
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
    }
  };

  const handleApply = async (recommendation: ProjectRecommendation, event: React.MouseEvent) => {
    event.stopPropagation();

    // Track apply interaction
    await recommendationService.recordInteraction(
      recommendation.recommendation_id,
      'project',
      'apply',
    );

    // Trigger callback
    if (onApply) {
      onApply(recommendation.project_id);
    }
  };

  const getRelevanceColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score >= 0.7) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box>
        {[1, 2, 3].map((i) => (
          <Card key={i} sx={{ mb: 2 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="rectangular" height={60} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Alert severity="info">
        No recommendations available yet. Check back soon as we learn more about your preferences!
      </Alert>
    );
  }

  const visibleRecommendations = recommendations.filter(
    (rec) => !dismissedIds.has(rec.recommendation_id),
  );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon color="primary" />
        <Typography variant="h6">Recommended for You</Typography>
        <Tooltip title="Projects selected based on your skills, experience, and preferences">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack spacing={2}>
        {visibleRecommendations.map((recommendation) => (
          <Card
            key={recommendation.recommendation_id}
            sx={{
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              },
            }}
            onClick={() => handleProjectView(recommendation)}
          >
            <CardContent>
              {/* Header with relevance score */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" component="div" gutterBottom>
                    Project #{recommendation.project_id.slice(0, 8)}
                  </Typography>
                  <Rating
                    value={recommendation.relevance_score * 5}
                    precision={0.1}
                    readOnly
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Chip
                    label={`${Math.round(recommendation.relevance_score * 100)}% Match`}
                    color={getRelevanceColor(recommendation.relevance_score)}
                    size="small"
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => handleDismiss(recommendation, e)}
                    aria-label="Dismiss recommendation"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              {/* Score Breakdown */}
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {recommendation.skill_match_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="How well your skills match the project requirements">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Skill Match
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(recommendation.skill_match_score * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                )}

                {recommendation.budget_fit_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="How well the budget aligns with your rate">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Budget Fit
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(recommendation.budget_fit_score * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                )}

                {recommendation.experience_match_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="How well your experience level matches the project complexity">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Experience
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(recommendation.experience_match_score * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                )}

                {recommendation.recency_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="Project freshness - newer projects score higher">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Freshness
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(recommendation.recency_score * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                )}
              </Grid>

              {/* Explanations */}
              {showExplanations && recommendation.explanation.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Why this recommendation?
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {recommendation.explanation.map((reason, index) => (
                      <Chip key={index} label={reason} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Rank Position */}
              <Typography variant="caption" color="text.secondary">
                #{recommendation.rank_position} of {recommendations.length} recommendations
              </Typography>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
              <Button
                size="small"
                startIcon={<ViewIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleProjectView(recommendation);
                }}
              >
                View Details
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={(e) => handleApply(recommendation, e)}
              >
                Apply Now
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Load More */}
      {visibleRecommendations.length > 0 && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button variant="outlined" onClick={loadRecommendations}>
            Refresh Recommendations
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default RecommendedProjectsFeed;
