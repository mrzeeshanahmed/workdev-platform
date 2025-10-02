import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Button,
  Tooltip,
} from '@mui/material';
import { RateReview, CheckCircle, AccessTime } from '@mui/icons-material';
import { useClient } from '../context/ClientContext';
import { ReviewSubmissionDialog } from './ReviewSubmissionDialog';
import type { HiringHistoryItem } from '../types';

interface HiringHistoryTableProps {
  clientId: string;
}

export const HiringHistoryTable: React.FC<HiringHistoryTableProps> = ({ clientId }) => {
  const { hiringHistory, loadHiringHistory } = useClient();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedHire, setSelectedHire] = useState<HiringHistoryItem | null>(null);

  useEffect(() => {
    loadHiringHistory(clientId);
  }, [clientId, loadHiringHistory]);

  const getStatusColor = (
    status: string,
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'active':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getOutcomeColor = (
    outcome: string | null,
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (outcome) {
      case 'successful':
        return 'success';
      case 'disputed':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const canReview = (hire: HiringHistoryItem): boolean => {
    return (
      hire.status === 'completed' && hire.outcome === 'successful' && !hire.client_review_submitted
    );
  };

  const handleOpenReviewDialog = (hire: HiringHistoryItem) => {
    setSelectedHire(hire);
    setReviewDialogOpen(true);
  };

  const handleCloseReviewDialog = () => {
    setReviewDialogOpen(false);
    setSelectedHire(null);
    // Reload hiring history to refresh review status
    loadHiringHistory(clientId);
  };

  if (hiringHistory.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Hiring History
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <Typography color="text.secondary">No hiring history yet</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Hiring History
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Developer</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Hire Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>Amount Paid</TableCell>
                  <TableCell align="center">Reviews</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hiringHistory.map((hire) => (
                  <TableRow key={hire.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar
                          src={hire.developer_avatar || undefined}
                          sx={{ width: 32, height: 32 }}
                        >
                          {hire.developer_name.charAt(0)}
                        </Avatar>
                        <Typography variant="body2">{hire.developer_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{hire.project_title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Budget: ${hire.project_budget.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(hire.hire_date).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={hire.status} color={getStatusColor(hire.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      {hire.outcome ? (
                        <Chip
                          label={hire.outcome}
                          color={getOutcomeColor(hire.outcome)}
                          size="small"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {hire.final_amount_paid ? (
                        <Typography variant="body2">
                          ${hire.final_amount_paid.toLocaleString()}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip
                          title={
                            hire.client_review_submitted ? 'You reviewed' : 'Review not submitted'
                          }
                        >
                          {hire.client_review_submitted ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <AccessTime color="disabled" fontSize="small" />
                          )}
                        </Tooltip>
                        <Tooltip
                          title={
                            hire.developer_review_submitted
                              ? 'Developer reviewed'
                              : 'Waiting for developer review'
                          }
                        >
                          {hire.developer_review_submitted ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <AccessTime color="disabled" fontSize="small" />
                          )}
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {canReview(hire) ? (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<RateReview />}
                          onClick={() => handleOpenReviewDialog(hire)}
                        >
                          Review
                        </Button>
                      ) : hire.client_review_submitted ? (
                        <Typography variant="caption" color="text.secondary">
                          Reviewed
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Review Submission Dialog */}
      {selectedHire && (
        <ReviewSubmissionDialog
          open={reviewDialogOpen}
          onClose={handleCloseReviewDialog}
          projectId={selectedHire.project_id}
          projectTitle={selectedHire.project_title}
          revieweeUserId={selectedHire.developer_id}
          revieweeName={selectedHire.developer_name}
          reviewerUserId={clientId}
          reviewType="developer"
        />
      )}
    </>
  );
};
