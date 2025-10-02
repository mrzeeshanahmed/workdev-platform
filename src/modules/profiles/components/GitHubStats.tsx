import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  GitHub as GitHubIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import { githubIntegrationService, GitHubData } from '../services/GitHubIntegrationService';

interface GitHubStatsProps {
  userId: string;
}

export const GitHubStats: React.FC<GitHubStatsProps> = ({ userId }) => {
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGitHubData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cachedData = await githubIntegrationService.fetchGitHubData(userId);

    if (cachedData && !githubIntegrationService.shouldRefreshCache(cachedData)) {
      setGithubData(cachedData);
      setLoading(false);
      return;
    }

    const result = await githubIntegrationService.syncDeveloperGitHubData(userId);

    if (result.success && result.data) {
      setGithubData(result.data);
    } else {
      setError(result.error || 'Failed to load GitHub data');
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadGitHubData();
  }, [loadGitHubData]);

  const handleRefresh = async () => {
    setSyncing(true);
    const result = await githubIntegrationService.syncDeveloperGitHubData(userId, true);

    if (result.success && result.data) {
      setGithubData(result.data);
      setError(null);
    } else {
      setError(result.error || 'Failed to sync GitHub data');
    }

    setSyncing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2} alignItems="center">
            <GitHubIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            <Typography>Loading GitHub data...</Typography>
            <LinearProgress sx={{ width: '100%' }} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="error">{error}</Typography>
            <Button variant="outlined" onClick={handleRefresh}>
              Retry
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!githubData) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">No GitHub data available</Typography>
        </CardContent>
      </Card>
    );
  }

  const stats = githubIntegrationService.getContributionStats(githubData);
  const topLanguages = githubIntegrationService.getTopLanguages(githubData, 5);
  const profileStrength = githubIntegrationService.calculateProfileStrength(githubData);

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <GitHubIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6">{githubData.name || githubData.username}</Typography>
                <Typography variant="body2" color="text.secondary">
                  @{githubData.username}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Refresh'}
            </Button>
          </Stack>

          {githubData.bio && (
            <Typography variant="body2" mt={2}>
              {githubData.bio}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary" mt={1} display="block">
            Last synced: {new Date(githubData.last_synced_at).toLocaleString()}
          </Typography>
        </CardContent>
      </Card>

      {/* Profile Strength */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">GitHub Profile Strength</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon color={profileStrength >= 70 ? 'success' : 'warning'} />
                <Typography
                  variant="h6"
                  color={profileStrength >= 70 ? 'success.main' : 'warning.main'}
                >
                  {profileStrength}/100
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={profileStrength}
              color={profileStrength >= 70 ? 'success' : 'warning'}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {githubData.public_repos}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Public Repos
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {githubData.total_stars}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Stars
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {githubData.followers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Followers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {stats.totalContributions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Contributions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Contribution Stats */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Contribution Activity
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <Typography variant="h5" color="success.main">
                {stats.currentStreak}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Streak (days)
              </Typography>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Typography variant="h5" color="info.main">
                {stats.longestStreak}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Longest Streak (days)
              </Typography>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Typography variant="h5" color="primary">
                {stats.averagePerDay}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average per Day
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Top Languages */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top Languages
          </Typography>
          <Stack spacing={2}>
            {topLanguages.map(({ language, count, percentage }) => (
              <Box key={language}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">{language}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {count} repos · {percentage}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Pinned Repositories */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pinned Repositories
          </Typography>
          <Grid container spacing={2}>
            {githubData.pinned_repos.map((repo) => (
              <Grid size={{ xs: 12, sm: 6 }} key={repo.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      component="a"
                      href={repo.html_url}
                      target="_blank"
                      sx={{ textDecoration: 'none', color: 'primary.main' }}
                    >
                      {repo.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {repo.description || 'No description'}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                      {repo.language && (
                        <Chip label={repo.language} size="small" variant="outlined" />
                      )}
                      <Chip label={`⭐ ${repo.stargazers_count}`} size="small" />
                      <Chip label={`🍴 ${repo.forks_count}`} size="small" />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
};
