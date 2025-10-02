/**
 * Talent Pool Dashboard - Main Component
 *
 * Primary interface for managing client-developer relationships
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Stack,
  Badge,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TalentPoolService from '../services/TalentPoolService';
import type {
  TalentPool,
  TalentPoolMemberWithProfile,
  TalentPoolStatistics,
  AvailabilityNotificationSummary,
  SearchTalentPoolParams,
  BulkActionType,
} from '../types';
import { TalentPoolList } from '../components/TalentPoolList';
import { TalentPoolMembersList } from '../components/TalentPoolMembersList';
import { TalentPoolFilters } from '../components/TalentPoolFilters';
import { CreatePoolDialog } from '../components/CreatePoolDialog';
import { AvailabilityNotifications } from '../components/AvailabilityNotifications';

interface TalentPoolDashboardProps {
  clientUserId: string;
}

export const TalentPoolDashboard: React.FC<TalentPoolDashboardProps> = ({ clientUserId }) => {
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolMembers, setPoolMembers] = useState<TalentPoolMemberWithProfile[]>([]);
  const [statistics, setStatistics] = useState<TalentPoolStatistics | null>(null);
  const [notifications, setNotifications] = useState<AvailabilityNotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Load pool members when selected pool changes
  const loadPoolMembers = useCallback(
    async (poolId: string) => {
      try {
        const members = await TalentPoolService.getPoolMembers(poolId, clientUserId);
        setPoolMembers(members);
      } catch (err) {
        console.error('Failed to load pool members:', err);
        setError('Failed to load pool members');
      }
    },
    [clientUserId],
  );

  // Search with filters
  const searchWithFilters = useCallback(
    async (filters: SearchTalentPoolParams) => {
      try {
        setLoading(true);
        const results = await TalentPoolService.searchTalentPool(clientUserId, filters);
        // Convert search results to member format
        setPoolMembers(results as any);
      } catch (err) {
        console.error('Failed to search:', err);
        setError('Failed to search talent pool');
      } finally {
        setLoading(false);
      }
    },
    [clientUserId],
  );

  // Load initial dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [poolsData, statsData, notificationsData] = await Promise.all([
        TalentPoolService.getTalentPools(clientUserId),
        TalentPoolService.getStatistics(clientUserId),
        TalentPoolService.getAvailabilityNotifications(clientUserId),
      ]);

      setPools(poolsData);
      setStatistics(statsData);
      setNotifications(notificationsData);

      // Select first pool by default
      if (poolsData.length > 0 && !selectedPoolId) {
        setSelectedPoolId(poolsData[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [clientUserId, selectedPoolId]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load pool members when selected pool changes
  useEffect(() => {
    if (selectedPoolId) {
      loadPoolMembers(selectedPoolId);
    }
  }, [selectedPoolId, loadPoolMembers]);

  const handleCreatePool = async (poolData: any) => {
    try {
      const newPool = await TalentPoolService.createTalentPool(clientUserId, poolData);
      setPools([newPool, ...pools]);
      setSelectedPoolId(newPool.id);
      setCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create pool:', err);
      setError('Failed to create talent pool');
    }
  };

  const handleSelectPool = (poolId: string) => {
    setSelectedPoolId(poolId);
  };

  const handleFiltersChange = useCallback(
    (filters: SearchTalentPoolParams) => {
      // Apply filters through search
      searchWithFilters(filters);
    },
    [searchWithFilters],
  );

  const handleBulkAction = async (action: BulkActionType, memberIds: string[]) => {
    try {
      switch (action) {
        case 'invite_to_project':
          // Show project selection modal (to be implemented)
          console.log('Invite to project:', memberIds);
          break;
        case 'send_message':
          // Show message composition modal (to be implemented)
          console.log('Send message:', memberIds);
          break;
        case 'update_tags':
          // Show tag update modal (to be implemented)
          console.log('Update tags:', memberIds);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Bulk action failed:', err);
      setError('Bulk action failed');
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    try {
      await TalentPoolService.markNotificationsAsSent([notificationId]);
      setNotifications(notifications.filter((n) => n.developer_id !== notificationId));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  if (loading && pools.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Talent Pool</Typography>
        <Stack direction="row" spacing={2}>
          <Badge badgeContent={notifications.length} color="error">
            <Button
              variant="outlined"
              startIcon={<NotificationsIcon />}
              onClick={() => setNotificationsOpen(true)}
            >
              Notifications
            </Button>
          </Badge>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Pool
          </Button>
        </Stack>
      </Stack>

      {/* Statistics */}
      {statistics && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="primary">
                {statistics.total_developers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Developers
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="success.main">
                {statistics.available_developers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available Now
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="warning.main">
                {statistics.favorite_developers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Favorites
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="info.main">
                {statistics.average_rating?.toFixed(1) || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Rating
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Pools Sidebar */}
        <Grid item xs={12} md={3}>
          <TalentPoolList
            pools={pools}
            selectedPoolId={selectedPoolId}
            onSelectPool={handleSelectPool}
            onCreatePool={() => setCreateDialogOpen(true)}
            onEditPool={(pool: TalentPool) => console.log('Edit pool:', pool)}
            onDeletePool={(poolId: string) => console.log('Delete pool:', poolId)}
          />
        </Grid>

        {/* Members Content */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
              <Tab label="Members" />
              <Tab label="Search" />
              <Tab label="Activity" />
            </Tabs>

            {tabValue === 0 && selectedPoolId && (
              <>
                <TalentPoolFilters
                  onFiltersChange={handleFiltersChange}
                  availableSkills={[]}
                  availableTags={[]}
                  pools={pools}
                />
                <TalentPoolMembersList
                  members={poolMembers}
                  loading={loading}
                  onViewProfile={(developerId: string) => console.log('View profile:', developerId)}
                  onUpdateMember={(memberId: string, data: any) =>
                    console.log('Update member:', memberId, data)
                  }
                  onRemoveMember={(memberId: string) => console.log('Remove member:', memberId)}
                  onLogContact={(developerId: string) => console.log('Log contact:', developerId)}
                  onBulkAction={handleBulkAction}
                />
              </>
            )}

            {tabValue === 1 && (
              <Box>
                <Typography>Advanced search across all pools</Typography>
              </Box>
            )}

            {tabValue === 2 && (
              <Box>
                <Typography>Recent activity log</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <CreatePoolDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreatePool}
      />

      <AvailabilityNotifications
        notifications={notifications}
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onDismiss={handleDismissNotification}
        onContactDeveloper={(developerId: string) => console.log('Contact developer:', developerId)}
      />
    </Box>
  );
};

export default TalentPoolDashboard;
