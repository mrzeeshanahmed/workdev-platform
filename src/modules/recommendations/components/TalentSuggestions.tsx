/**
 * Talent Suggestions Component
 * Displays personalized developer recommendations for clients
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
  Avatar,
  Rating,
  Grid,
} from '@mui/material';
import {
  PersonSearch as PersonSearchIcon,
  Close as CloseIcon,
  ContactMail as ContactIcon,
  Info as InfoIcon,
  Star as StarIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { recommendationService } from 'modules/recommendations';
import type { TalentRecommendation } from 'modules/recommendations/types';
import { useAuth } from 'modules/auth';

interface TalentSuggestionsProps {
  projectId: string;
  limit?: number;
  showExplanations?: boolean;
  onDeveloperClick?: (developerId: string) => void;
  onContact?: (developerId: string) => void;
}

export const TalentSuggestions: React.FC<TalentSuggestionsProps> = ({
  projectId,
  limit = 10,
  showExplanations = true,
  onDeveloperClick,
  onContact,
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<TalentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && projectId) {
      loadRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId, limit]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const recs = await recommendationService.getTalentRecommendations(projectId, user!.id, {
        limit,
        refresh: false,
      });

      setRecommendations(recs);
    } catch (err) {
      console.error('Error loading talent recommendations:', err);
      setError('Failed to load talent suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeveloperView = async (recommendation: TalentRecommendation) => {
    // Track view interaction
    await recommendationService.markAsViewed(recommendation.recommendation_id, 'talent');

    // Trigger callback
    if (onDeveloperClick) {
      onDeveloperClick(recommendation.developer_user_id);
    }
  };

  const handleDismiss = async (recommendation: TalentRecommendation, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      await recommendationService.dismissRecommendation(recommendation.recommendation_id, 'talent');

      setDismissedIds((prev) => new Set(prev).add(recommendation.recommendation_id));
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
    }
  };

  const handleContact = async (recommendation: TalentRecommendation, event: React.MouseEvent) => {
    event.stopPropagation();

    // Track contact interaction
    await recommendationService.recordInteraction(
      recommendation.recommendation_id,
      'talent',
      'contact',
    );

    // Trigger callback
    if (onContact) {
      onContact(recommendation.developer_user_id);
    }
  };

  const getRelevanceColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score >= 0.7) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  const getInitials = (developerId: string): string => {
    return developerId.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Box>
        {[1, 2, 3].map((i) => (
          <Card key={i} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Skeleton variant="circular" width={60} height={60} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="rectangular" height={40} sx={{ mt: 2 }} />
                </Box>
              </Box>
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
        No talent suggestions available yet. Check back soon as we find developers matching your
        project requirements!
      </Alert>
    );
  }

  const visibleRecommendations = recommendations.filter(
    (rec) => !dismissedIds.has(rec.recommendation_id),
  );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonSearchIcon color="primary" />
        <Typography variant="h6">Suggested Talent</Typography>
        <Tooltip title="Developers recommended based on skills, experience, and project fit">
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
            onClick={() => handleDeveloperView(recommendation)}
          >
            <CardContent>
              {/* Header with avatar and relevance */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar
                  sx={{
                    width: 60,
                    height: 60,
                    bgcolor: 'primary.main',
                    fontSize: '1.5rem',
                  }}
                >
                  {getInitials(recommendation.developer_user_id)}
                </Avatar>

                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      Developer #{recommendation.developer_user_id.slice(0, 8)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Chip
                        label={`${Math.round(recommendation.relevance_score * 100)}% Match`}
                        color={getRelevanceColor(recommendation.relevance_score)}
                        size="small"
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => handleDismiss(recommendation, e)}
                        aria-label="Dismiss suggestion"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Rating
                    value={recommendation.relevance_score * 5}
                    precision={0.1}
                    readOnly
                    size="small"
                  />
                </Box>
              </Box>

              {/* Score Breakdown */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {recommendation.skill_match_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Tooltip title="How well the developer's skills match your project needs">
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

                {recommendation.experience_match_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Tooltip title="Experience level alignment with project complexity">
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

                {recommendation.availability_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Tooltip title="Developer availability for new projects">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Availability
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(recommendation.availability_score * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Grid>
                )}

                {recommendation.reputation_score !== undefined && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Tooltip title="Based on ratings, reviews, and project success">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon fontSize="small" color="warning" />
                        <Typography variant="body2" fontWeight="bold">
                          {recommendation.reputation_score.toFixed(1)} / 5.0
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
                    Why this developer?
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
                #{recommendation.rank_position} of {recommendations.length} suggestions
              </Typography>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
              <Button
                size="small"
                startIcon={<WorkIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeveloperView(recommendation);
                }}
              >
                View Profile
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<ContactIcon />}
                onClick={(e) => handleContact(recommendation, e)}
              >
                Contact
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Load More */}
      {visibleRecommendations.length > 0 && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button variant="outlined" onClick={loadRecommendations}>
            Refresh Suggestions
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default TalentSuggestions;
