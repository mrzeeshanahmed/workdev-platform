import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Button,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useMarketplace } from '../context/MarketplaceContext';
import { ProjectCard } from './ProjectCard';
import { SearchBar } from './SearchBar';
import { FilterSidebar } from './FilterSidebar';
import { SORT_OPTIONS } from '../types';

export const MarketplaceGrid: React.FC = () => {
  const {
    searchResults,
    featuredProjects,
    currentParams,
    isLoading,
    error,
    searchProjects,
    loadFeaturedProjects,
    updateSearchParams,
    trackProjectClick,
  } = useMarketplace();

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    // Initial load
    searchProjects(currentParams);
    loadFeaturedProjects();
    // Intentionally omitting dependencies to avoid re-running on every param change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectClick = async (projectId: string) => {
    await trackProjectClick(projectId);
    // Navigate to project details (implement your routing logic)
    window.location.href = `/projects/${projectId}`;
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    updateSearchParams({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (sortBy: string) => {
    updateSearchParams({
      sort_by: sortBy as any,
      page: 1,
    });
  };

  const handleRefresh = () => {
    searchProjects(currentParams);
  };

  return (
    <Box>
      {/* Search Bar */}
      <SearchBar onToggleFilters={() => setFiltersOpen(true)} />

      {/* Filter Sidebar */}
      <FilterSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />

      {/* Featured Projects Section */}
      {featuredProjects.length > 0 && (
        <Box mb={4}>
          <Typography variant="h5" gutterBottom>
            Featured Projects
          </Typography>
          <Grid container spacing={3}>
            {featuredProjects.map((project) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                <ProjectCard project={project} onViewDetails={handleProjectClick} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Results Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          {searchResults && (
            <Typography variant="body1" color="text.secondary">
              {searchResults.total} projects found
              {searchResults.search_time_ms && (
                <Typography component="span" variant="caption" ml={1}>
                  ({searchResults.search_time_ms}ms)
                </Typography>
              )}
            </Typography>
          )}
        </Box>

        <Box display="flex" gap={2} alignItems="center">
          <Button startIcon={<Refresh />} onClick={handleRefresh} disabled={isLoading} size="small">
            Refresh
          </Button>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={currentParams.sort_by || 'newest'}
              onChange={(e) => handleSortChange(e.target.value)}
              label="Sort By"
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* Results Grid */}
      {!isLoading && searchResults && (
        <>
          {searchResults.projects.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" gutterBottom>
                No projects found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search criteria or filters
              </Typography>
            </Box>
          ) : (
            <>
              <Grid container spacing={3}>
                {searchResults.projects.map((project) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                    <ProjectCard project={project} onViewDetails={handleProjectClick} />
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {searchResults.total_pages > 1 && (
                <Box display="flex" justifyContent="center" mt={4}>
                  <Pagination
                    count={searchResults.total_pages}
                    page={currentParams.page || 1}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};
