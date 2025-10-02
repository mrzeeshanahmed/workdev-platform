import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Rating,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useClient } from '../context/ClientContext';
import type { ProjectReviewInput } from '../types';

interface ReviewSubmissionDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  revieweeUserId: string;
  revieweeName: string;
  reviewerUserId: string;
  reviewType: 'client' | 'developer'; // Who is being reviewed
}

export const ReviewSubmissionDialog: React.FC<ReviewSubmissionDialogProps> = ({
  open,
  onClose,
  projectId,
  projectTitle,
  revieweeUserId,
  revieweeName,
  reviewerUserId,
  reviewType,
}) => {
  const { submitReview, checkReviewEligibility } = useClient();

  const [ratings, setRatings] = useState({
    communication: 0,
    professionalism: 0,
    // Client-specific
    project_clarity: 0,
    payment_timeliness: 0,
    // Developer-specific
    quality: 0,
    expertise: 0,
    responsiveness: 0,
  });

  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);

  useEffect(() => {
    if (open) {
      checkEligibility();
    }
    // Intentionally omit checkEligibility from deps to avoid re-checking while dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, reviewerUserId]);

  const checkEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const result = await checkReviewEligibility(projectId, reviewerUserId);
      setEligibility(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleRatingChange = (field: string, value: number | null) => {
    setRatings((prev) => ({ ...prev, [field]: value || 0 }));
  };

  const handleSubmit = async () => {
    // Validate required ratings
    if (ratings.communication === 0 || ratings.professionalism === 0) {
      setError('Please provide all required ratings');
      return;
    }

    if (reviewType === 'client') {
      if (ratings.project_clarity === 0 || ratings.payment_timeliness === 0) {
        setError('Please provide all client-specific ratings');
        return;
      }
    } else {
      if (ratings.quality === 0 || ratings.expertise === 0 || ratings.responsiveness === 0) {
        setError('Please provide all developer-specific ratings');
        return;
      }
    }

    if (!comment.trim()) {
      setError('Please provide a review comment');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reviewData: ProjectReviewInput = {
        project_id: projectId,
        reviewee_user_id: revieweeUserId,
        reviewee_type: reviewType,
        rating_communication: ratings.communication,
        rating_professionalism: ratings.professionalism,
        rating_project_clarity: reviewType === 'client' ? ratings.project_clarity : undefined,
        rating_payment_timeliness: reviewType === 'client' ? ratings.payment_timeliness : undefined,
        rating_quality: reviewType === 'developer' ? ratings.quality : undefined,
        rating_expertise: reviewType === 'developer' ? ratings.expertise : undefined,
        rating_responsiveness: reviewType === 'developer' ? ratings.responsiveness : undefined,
        comment: comment.trim(),
      };

      const result = await submitReview(reviewerUserId, reviewData);

      if (result.success) {
        onClose();
        // Reset form
        setRatings({
          communication: 0,
          professionalism: 0,
          project_clarity: 0,
          payment_timeliness: 0,
          quality: 0,
          expertise: 0,
          responsiveness: 0,
        });
        setComment('');
      } else {
        setError(result.error || 'Failed to submit review');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    const basicValid = ratings.communication > 0 && ratings.professionalism > 0 && comment.trim();

    if (reviewType === 'client') {
      return basicValid && ratings.project_clarity > 0 && ratings.payment_timeliness > 0;
    } else {
      return (
        basicValid && ratings.quality > 0 && ratings.expertise > 0 && ratings.responsiveness > 0
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review {revieweeName}</DialogTitle>
      <DialogContent>
        {isCheckingEligibility ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : !eligibility?.can_review ? (
          <Alert severity="error">{eligibility?.reason || 'Cannot submit review'}</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Project: {projectTitle}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ mt: 2 }}>
              {/* Common Ratings */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Communication *
                </Typography>
                <Rating
                  value={ratings.communication}
                  onChange={(_, value) => handleRatingChange('communication', value)}
                  size="large"
                />
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Professionalism *
                </Typography>
                <Rating
                  value={ratings.professionalism}
                  onChange={(_, value) => handleRatingChange('professionalism', value)}
                  size="large"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Client-Specific Ratings */}
              {reviewType === 'client' && (
                <>
                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Project Clarity *
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      How clear were the project requirements and expectations?
                    </Typography>
                    <Rating
                      value={ratings.project_clarity}
                      onChange={(_, value) => handleRatingChange('project_clarity', value)}
                      size="large"
                    />
                  </Box>

                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Payment Timeliness *
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      How timely were the payments?
                    </Typography>
                    <Rating
                      value={ratings.payment_timeliness}
                      onChange={(_, value) => handleRatingChange('payment_timeliness', value)}
                      size="large"
                    />
                  </Box>
                </>
              )}

              {/* Developer-Specific Ratings */}
              {reviewType === 'developer' && (
                <>
                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Work Quality *
                    </Typography>
                    <Rating
                      value={ratings.quality}
                      onChange={(_, value) => handleRatingChange('quality', value)}
                      size="large"
                    />
                  </Box>

                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Technical Expertise *
                    </Typography>
                    <Rating
                      value={ratings.expertise}
                      onChange={(_, value) => handleRatingChange('expertise', value)}
                      size="large"
                    />
                  </Box>

                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Responsiveness *
                    </Typography>
                    <Rating
                      value={ratings.responsiveness}
                      onChange={(_, value) => handleRatingChange('responsiveness', value)}
                      size="large"
                    />
                  </Box>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Comment */}
              <Box mb={2}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Your Review *"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`Share your experience working with ${revieweeName}...`}
                  disabled={isSubmitting}
                />
                <Typography variant="caption" color="text.secondary">
                  Reviews become visible to both parties only after both have submitted their
                  reviews.
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid() || isSubmitting || !eligibility?.can_review}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
