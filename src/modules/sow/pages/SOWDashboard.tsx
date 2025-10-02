/**
 * SOW Dashboard Component
 *
 * Main interface for managing Statement of Work documents
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
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SOWService from '../services/SOWService';
import type {
  SOWDocument,
  SOWDocumentWithDetails,
  SOWTemplate,
  SOWStatistics,
  GenerateSOWRequest,
} from '../types';

interface SOWDashboardProps {
  userId: string;
  userRole: 'client' | 'developer';
}

export const SOWDashboard: React.FC<SOWDashboardProps> = ({ userId, userRole }) => {
  const [documents, setDocuments] = useState<SOWDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SOWDocumentWithDetails | null>(null);
  const [statistics, setStatistics] = useState<SOWStatistics | null>(null);
  const [templates, setTemplates] = useState<SOWTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [documentsData, statsData, templatesData] = await Promise.all([
        SOWService.getSOWDocuments(userId),
        SOWService.getStatistics(userId),
        SOWService.getTemplates(),
      ]);

      setDocuments(documentsData);
      setStatistics(statsData);
      setTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load selected document details
  const loadDocumentDetails = useCallback(
    async (documentId: string) => {
      try {
        const details = await SOWService.getSOWDocument(documentId, userId);
        setSelectedDocument(details);
      } catch (err) {
        console.error('Failed to load document details:', err);
        setError('Failed to load document details');
      }
    },
    [userId],
  );

  const handleSelectDocument = (documentId: string) => {
    loadDocumentDetails(documentId);
  };

  const handleCreateSOW = async (request: GenerateSOWRequest) => {
    try {
      const response = await SOWService.generateSOW(userId, request);
      setDocuments([response.sow_document, ...documents]);
      setCreateDialogOpen(false);
      setSelectedDocument(null);
      loadDashboardData();
    } catch (err) {
      console.error('Failed to create SOW:', err);
      setError('Failed to create SOW document');
    }
  };

  // no-op reference to avoid lint warning when handler is not wired into UI yet
  void handleCreateSOW;

  const handleRequestSignature = async (documentId: string) => {
    try {
      // Implementation would open signature request dialog
      console.log('Request signature for:', documentId);
    } catch (err) {
      console.error('Failed to request signature:', err);
      setError('Failed to request signatures');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Statement of Work Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Generate SOW
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <DescriptionIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h4">{statistics.total_sows}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total SOWs
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <PendingActionsIcon color="warning" fontSize="large" />
                  <Box>
                    <Typography variant="h4">{statistics.pending_signatures}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Signatures
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <CheckCircleIcon color="success" fontSize="large" />
                  <Box>
                    <Typography variant="h4">{statistics.signed_sows}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Signed SOWs
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box>
                    <Typography variant="h4">
                      ${statistics.total_contract_value.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Contract Value
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* SOW List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              SOW Documents
            </Typography>

            <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} sx={{ mb: 2 }}>
              <Tab label="All" />
              <Tab label="Pending" />
              <Tab label="Signed" />
            </Tabs>

            <Stack spacing={2}>
              {documents
                .filter((doc) => {
                  if (tabValue === 1) return doc.status === 'pending_signatures';
                  if (tabValue === 2) return doc.status === 'signed';
                  return true;
                })
                .map((doc) => (
                  <Card
                    key={doc.id}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      border: selectedDocument?.id === doc.id ? '2px solid' : '1px solid',
                      borderColor: selectedDocument?.id === doc.id ? 'primary.main' : 'divider',
                    }}
                    onClick={() => handleSelectDocument(doc.id)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" noWrap>
                        {doc.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.document_number}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={doc.status}
                          size="small"
                          color={
                            doc.status === 'signed'
                              ? 'success'
                              : doc.status === 'pending_signatures'
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}

              {documents.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No SOW documents yet. Generate your first one!
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Document Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            {selectedDocument ? (
              <Box>
                <Typography variant="h5" gutterBottom>
                  {selectedDocument.title}
                </Typography>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Chip label={selectedDocument.status} color="primary" />
                  <Chip label={`Version ${selectedDocument.version}`} variant="outlined" />
                  <Chip
                    label={`${selectedDocument.currency} ${selectedDocument.total_budget.toLocaleString()}`}
                    variant="outlined"
                  />
                </Stack>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Milestones ({selectedDocument.milestones.length})
                </Typography>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  {selectedDocument.milestones.map((milestone) => (
                    <Card key={milestone.id} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">
                          Milestone {milestone.milestone_number}: {milestone.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Budget: ${milestone.budget.toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>

                <Typography variant="h6" gutterBottom>
                  Signatures
                </Typography>
                <Stack spacing={1}>
                  {selectedDocument.signatures.map((signature) => (
                    <Card key={signature.id} variant="outlined">
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle2">{signature.signer_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {signature.signer_role}
                            </Typography>
                          </Box>
                          <Chip
                            label={signature.status}
                            color={signature.status === 'signed' ? 'success' : 'default'}
                            size="small"
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  {selectedDocument.document_url && (
                    <Button variant="outlined" href={selectedDocument.document_url} target="_blank">
                      Download PDF
                    </Button>
                  )}
                  {selectedDocument.status === 'draft' && (
                    <Button
                      variant="contained"
                      onClick={() => handleRequestSignature(selectedDocument.id)}
                    >
                      Request Signatures
                    </Button>
                  )}
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 400,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a document to view details
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create SOW Dialog - placeholder for future implementation */}
      {createDialogOpen && (
        <Alert severity="info" sx={{ mt: 2 }}>
          SOW Generation Dialog would appear here. Implementation pending.
          {/* reference templates to avoid unused variable lint warning */}
          {templates.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {`Loaded ${templates.length} templates`}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
};

export default SOWDashboard;
