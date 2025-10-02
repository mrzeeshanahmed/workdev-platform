import React from 'react';
import { Box, Typography, Chip, LinearProgress, Stack } from '@mui/material';
import { TrendingUp, Public, Star, CompareArrows } from '@mui/icons-material';
import type { MarketInsightsPanelProps } from '../types';

export const MarketInsightsPanel: React.FC<MarketInsightsPanelProps> = ({ insights }) => {
  const demandLevel =
    insights.market_demand_factor > 1.2
      ? 'High'
      : insights.market_demand_factor > 0.9
        ? 'Medium'
        : 'Low';
  const demandColor =
    demandLevel === 'High' ? 'success' : demandLevel === 'Medium' ? 'warning' : 'error';

  return (
    <Box>
      <Stack spacing={2}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CompareArrows sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="body2" fontWeight="bold">
              Similar Projects Average
            </Typography>
          </Box>
          <Typography variant="h6" color="primary">
            ${insights.similar_projects_avg.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Based on historical data from comparable projects
          </Typography>
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TrendingUp sx={{ mr: 1, color: 'secondary.main' }} />
            <Typography variant="body2" fontWeight="bold">
              Market Demand
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={demandLevel} color={demandColor} size="small" />
            <Typography variant="body2" color="text.secondary">
              {(insights.market_demand_factor * 100).toFixed(0)}% of baseline
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(insights.market_demand_factor * 100, 100)}
            sx={{ mt: 1, height: 6, borderRadius: 3 }}
          />
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Public sx={{ mr: 1, color: 'info.main' }} />
            <Typography variant="body2" fontWeight="bold">
              Regional Adjustment
            </Typography>
          </Box>
          <Typography variant="body2">
            {insights.regional_adjustment > 1
              ? `+${((insights.regional_adjustment - 1) * 100).toFixed(0)}%`
              : `-${((1 - insights.regional_adjustment) * 100).toFixed(0)}%`}{' '}
            for your region
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Market rates vary by geographic location
          </Typography>
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Star sx={{ mr: 1, color: 'warning.main' }} />
            <Typography variant="body2" fontWeight="bold">
              Average Hourly Rate
            </Typography>
          </Box>
          <Typography variant="h6" color="text.primary">
            ${insights.average_hourly_rate.toFixed(2)}/hr
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Weighted average for required skills
          </Typography>
        </Box>

        {insights.skill_premium_factors &&
          Object.keys(insights.skill_premium_factors).length > 0 && (
            <Box>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Skill Premiums
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(insights.skill_premium_factors).map(([skill, factor]) => (
                  <Chip
                    key={skill}
                    label={`${skill}: ${factor > 1 ? '+' : ''}${((factor - 1) * 100).toFixed(0)}%`}
                    size="small"
                    color={factor > 1.1 ? 'secondary' : 'default'}
                    variant={factor > 1.1 ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>
          )}
      </Stack>
    </Box>
  );
};
