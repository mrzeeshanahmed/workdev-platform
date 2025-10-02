import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import type { ConfidenceIntervalDisplayProps } from '../types';

export const ConfidenceIntervalDisplay: React.FC<ConfidenceIntervalDisplayProps> = ({
  interval,
}) => {
  const { lower_bound, upper_bound, confidence_level } = interval;
  const range = upper_bound - lower_bound;
  const midPoint = (lower_bound + upper_bound) / 2;
  const variance = (range / midPoint) * 100;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <InfoOutlined sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          {confidence_level}% Confidence Interval
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={100}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'success.light',
            },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="caption" fontWeight="bold" color="text.primary">
              ${lower_bound.toLocaleString()}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Low
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" fontWeight="bold" color="text.primary">
              ${upper_bound.toLocaleString()}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              High
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 4,
          p: 1.5,
          backgroundColor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Range
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            ${range.toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            Variance
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            ±{variance.toFixed(1)}%
          </Typography>
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        We are {confidence_level}% confident that the actual budget will fall within this range
        based on similar historical projects.
      </Typography>
    </Box>
  );
};
