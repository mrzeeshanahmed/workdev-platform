import { Autocomplete, Chip, CircularProgress, TextField } from '@mui/material';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { ProfileService } from '../services/ProfileService';

interface SkillsAutocompleteProps {
  value: string[];
  onChange: (skills: string[]) => void;
}

export const SkillsAutocomplete = ({ value, onChange }: SkillsAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const profileService = useMemo(() => new ProfileService(), []);

  const searchSkills = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const results = await profileService.searchSkills(query);
        // Extract just the skill names
        setOptions(results.map((skill) => skill.name));
      } catch (error) {
        console.error('Error searching skills:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [profileService],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchSkills(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchSkills]);

  return (
    <Autocomplete
      multiple
      freeSolo
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => setInputValue(newInputValue)}
      options={options}
      loading={loading}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip label={option} {...getTagProps({ index })} key={option} />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Type to search skills..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
