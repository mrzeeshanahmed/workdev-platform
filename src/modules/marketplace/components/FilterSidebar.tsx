import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Checkbox,
  FormGroup,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
import { Close, FilterList } from '@mui/icons-material';
import { useMarketplace } from '../context/MarketplaceContext';
import { PROJECT_TYPES, DURATION_OPTIONS, BUDGET_RANGES } from '../types';

interface FilterSidebarProps {
  open: boolean;
  onClose: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ open, onClose }) => {
  const { currentParams, updateSearchParams, clearFilters } = useMarketplace();

  const [budgetRange, setBudgetRange] = React.useState<[number, number]>([
    currentParams.budget_min || 0,
    currentParams.budget_max || 100000,
  ]);

  const handleProjectTypeChange = (value: 'fixed' | 'hourly' | 'all') => {
    updateSearchParams({
      project_type: value === 'all' ? undefined : value,
      page: 1,
    });
  };

  const handleDurationChange = (value: 'short' | 'medium' | 'long' | 'all') => {
    updateSearchParams({
      duration: value === 'all' ? undefined : value,
      page: 1,
    });
  };

  const handleRemoteOnlyChange = (checked: boolean) => {
    updateSearchParams({
      remote_only: checked || undefined,
      page: 1,
    });
  };

  const handleBudgetChange = (_: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      setBudgetRange(newValue as [number, number]);
    }
  };

  const handleBudgetCommit = () => {
    updateSearchParams({
      budget_min: budgetRange[0] > 0 ? budgetRange[0] : undefined,
      budget_max: budgetRange[1] < 100000 ? budgetRange[1] : undefined,
      page: 1,
    });
  };

  const handleClearAll = () => {
    setBudgetRange([0, 100000]);
    clearFilters();
  };

  const activeFiltersCount = [
    currentParams.project_type,
    currentParams.duration,
    currentParams.remote_only,
    currentParams.budget_min,
    currentParams.budget_max,
  ].filter(Boolean).length;

  // Avoid unused constant lint when BUDGET_RANGES isn't used in the component yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _budgetRangesRef = BUDGET_RANGES;

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 320, p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterList />
            <Typography variant="h6">Filters</Typography>
            {activeFiltersCount > 0 && (
              <Chip label={activeFiltersCount} size="small" color="primary" />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Project Type Filter */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Project Type</FormLabel>
          <RadioGroup
            value={currentParams.project_type || 'all'}
            onChange={(e) => handleProjectTypeChange(e.target.value as 'fixed' | 'hourly' | 'all')}
          >
            <FormControlLabel value="all" control={<Radio />} label="All Types" />
            {PROJECT_TYPES.map((type) => (
              <FormControlLabel
                key={type.value}
                value={type.value}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ mb: 3 }} />

        {/* Duration Filter */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Duration</FormLabel>
          <RadioGroup
            value={currentParams.duration || 'all'}
            onChange={(e) =>
              handleDurationChange(e.target.value as 'short' | 'medium' | 'long' | 'all')
            }
          >
            <FormControlLabel value="all" control={<Radio />} label="All Durations" />
            {DURATION_OPTIONS.map((duration) => (
              <FormControlLabel
                key={duration.value}
                value={duration.value}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">{duration.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {duration.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ mb: 3 }} />

        {/* Budget Range Filter */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Budget Range</FormLabel>
          <Box sx={{ px: 1, pt: 2 }}>
            <Slider
              value={budgetRange}
              onChange={handleBudgetChange}
              onChangeCommitted={handleBudgetCommit}
              valueLabelDisplay="auto"
              min={0}
              max={100000}
              step={1000}
              valueLabelFormat={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="caption">${budgetRange[0].toLocaleString()}</Typography>
              <Typography variant="caption">${budgetRange[1].toLocaleString()}</Typography>
            </Box>
          </Box>
        </FormControl>

        <Divider sx={{ mb: 3 }} />

        {/* Location Filter */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend">Location</FormLabel>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentParams.remote_only || false}
                  onChange={(e) => handleRemoteOnlyChange(e.target.checked)}
                />
              }
              label="Remote Only"
            />
          </FormGroup>
        </FormControl>

        <Divider sx={{ mb: 3 }} />

        {/* Clear All Button */}
        {activeFiltersCount > 0 && (
          <Button fullWidth variant="outlined" onClick={handleClearAll}>
            Clear All Filters
          </Button>
        )}
      </Box>
    </Drawer>
  );
};
