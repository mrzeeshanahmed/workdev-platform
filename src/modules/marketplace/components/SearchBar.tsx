import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Autocomplete,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Search, Clear, FilterList } from '@mui/icons-material';
import { useMarketplace } from '../context/MarketplaceContext';
import { marketplaceService } from '../services/MarketplaceService';
import { useDebounce } from '../../../hooks/useDebounce';

interface SearchBarProps {
  onToggleFilters?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onToggleFilters }) => {
  const { currentParams, updateSearchParams } = useMarketplace();

  const [query, setQuery] = useState(currentParams.query || '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(currentParams.skills || []);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [skillInputValue, setSkillInputValue] = useState('');
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  const debouncedQuery = useDebounce(query, 500);
  const debouncedSkillInput = useDebounce(skillInputValue, 300);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery !== currentParams.query) {
      updateSearchParams({ query: debouncedQuery, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Trigger search when skills change
  useEffect(() => {
    if (JSON.stringify(selectedSkills) !== JSON.stringify(currentParams.skills)) {
      updateSearchParams({ skills: selectedSkills, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkills]);

  // Load skill suggestions
  useEffect(() => {
    if (debouncedSkillInput) {
      loadSkillSuggestions(debouncedSkillInput);
    }
  }, [debouncedSkillInput]);

  const loadSkillSuggestions = async (input: string) => {
    setIsLoadingSkills(true);
    try {
      const suggestions = await marketplaceService.getSkillSuggestions(input);
      setSkillOptions(suggestions);
    } catch (error) {
      console.error('Failed to load skill suggestions:', error);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const handleClearQuery = () => {
    setQuery('');
    updateSearchParams({ query: undefined, page: 1 });
  };

  const handleClearSkills = () => {
    setSelectedSkills([]);
    updateSearchParams({ skills: [], page: 1 });
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Main Search Bar */}
      <Box display="flex" gap={2} mb={2}>
        <TextField
          fullWidth
          placeholder="Search projects by title or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearQuery}>
                  <Clear />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {onToggleFilters && (
          <IconButton
            onClick={onToggleFilters}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <FilterList />
          </IconButton>
        )}
      </Box>

      {/* Skills Filter */}
      <Autocomplete
        multiple
        freeSolo
        options={skillOptions}
        value={selectedSkills}
        onChange={(_, newValue) => setSelectedSkills(newValue)}
        inputValue={skillInputValue}
        onInputChange={(_, newInputValue) => setSkillInputValue(newInputValue)}
        loading={isLoadingSkills}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Filter by skills (e.g., React, Node.js, Python)..."
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <FilterList />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {isLoadingSkills && <CircularProgress size={20} />}
                  {selectedSkills.length > 0 && (
                    <IconButton size="small" onClick={handleClearSkills}>
                      <Clear />
                    </IconButton>
                  )}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip label={option} size="small" {...getTagProps({ index })} key={option} />
          ))
        }
      />

      {/* Active Filters Summary */}
      {(query || selectedSkills.length > 0) && (
        <Box display="flex" gap={1} mt={2} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Active filters:
          </Typography>
          {query && <Chip label={`Search: "${query}"`} size="small" onDelete={handleClearQuery} />}
          {selectedSkills.length > 0 && (
            <Chip
              label={`${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''}`}
              size="small"
              onDelete={handleClearSkills}
            />
          )}
        </Box>
      )}
    </Box>
  );
};
