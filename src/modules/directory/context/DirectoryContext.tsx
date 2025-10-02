import React, { createContext, useCallback, useContext, useState } from 'react';
import { directoryService } from '../services/DirectoryService';
import type {
  DeveloperCard,
  DeveloperSearchParams,
  DeveloperSearchResult,
  DirectoryFilters,
  SavedSearch,
  WatchlistDeveloper,
} from '../types';

interface DirectoryContextValue {
  // State
  searchResults: DeveloperSearchResult | null;
  featuredDevelopers: DeveloperCard[];
  filters: DirectoryFilters | null;
  currentParams: DeveloperSearchParams;
  savedSearches: SavedSearch[];
  watchlist: WatchlistDeveloper[];
  isLoading: boolean;
  error: string | null;

  // Actions
  searchDevelopers: (params: Partial<DeveloperSearchParams>) => Promise<void>;
  loadFeaturedDevelopers: () => Promise<void>;
  loadFilters: () => Promise<void>;
  getDeveloperById: (id: string) => Promise<DeveloperCard | null>;
  getSimilarDevelopers: (id: string, limit?: number) => Promise<DeveloperCard[]>;
  updateSearchParams: (params: Partial<DeveloperSearchParams>) => void;
  clearFilters: () => void;
  trackDeveloperClick: (developerId: string) => Promise<void>;

  // Saved searches
  loadSavedSearches: () => Promise<void>;
  applySavedSearch: (search: SavedSearch) => Promise<void>;

  // Watchlist
  loadWatchlist: () => Promise<void>;
  checkWatchlistStatus: (developerId: string) => Promise<boolean>;
}

const DirectoryContext = createContext<DirectoryContextValue | null>(null);

export const DirectoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchResults, setSearchResults] = useState<DeveloperSearchResult | null>(null);
  const [featuredDevelopers, setFeaturedDevelopers] = useState<DeveloperCard[]>([]);
  const [filters, setFilters] = useState<DirectoryFilters | null>(null);
  const [currentParams, setCurrentParams] = useState<DeveloperSearchParams>({
    sort_by: 'availability',
    page: 1,
    limit: 12,
  });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistDeveloper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search developers
  const searchDevelopers = useCallback(
    async (params: Partial<DeveloperSearchParams>) => {
      setIsLoading(true);
      setError(null);

      const startTime = Date.now();

      try {
        const mergedParams = { ...currentParams, ...params };
        setCurrentParams(mergedParams);

        const result = await directoryService.searchDevelopers(mergedParams);
        setSearchResults(result);

        // Track analytics (non-blocking)
        const searchTime = Date.now() - startTime;
        void directoryService.trackSearchAnalytics(mergedParams, result.total, searchTime);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to search developers';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentParams],
  );

  // Load featured developers
  const loadFeaturedDevelopers = useCallback(async () => {
    try {
      const featured = await directoryService.getFeaturedDevelopers(6);
      setFeaturedDevelopers(featured);
    } catch (err) {
      console.error('Failed to load featured developers:', err);
    }
  }, []);

  // Load filter options
  const loadFilters = useCallback(async () => {
    try {
      const filterOptions = await directoryService.getAvailableFilters();
      setFilters(filterOptions);
    } catch (err) {
      console.error('Failed to load filters:', err);
    }
  }, []);

  // Get developer by ID
  const getDeveloperById = useCallback(async (id: string): Promise<DeveloperCard | null> => {
    try {
      return await directoryService.getDeveloperById(id);
    } catch (err) {
      console.error('Failed to get developer:', err);
      return null;
    }
  }, []);

  // Get similar developers
  const getSimilarDevelopers = useCallback(
    async (id: string, limit = 5): Promise<DeveloperCard[]> => {
      try {
        return await directoryService.getSimilarDevelopers(id, limit);
      } catch (err) {
        console.error('Failed to get similar developers:', err);
        return [];
      }
    },
    [],
  );

  // Update search params and re-search
  const updateSearchParams = useCallback(
    (params: Partial<DeveloperSearchParams>) => {
      void searchDevelopers(params);
    },
    [searchDevelopers],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    const resetParams: DeveloperSearchParams = {
      sort_by: 'availability',
      page: 1,
      limit: currentParams.limit || 12,
    };
    setCurrentParams(resetParams);
    void searchDevelopers(resetParams);
  }, [currentParams.limit, searchDevelopers]);

  // Track developer click
  const trackDeveloperClick = useCallback(async (developerId: string) => {
    try {
      await directoryService.trackDeveloperClick(developerId);
    } catch (err) {
      console.warn('Failed to track click:', err);
    }
  }, []);

  // Load saved searches
  const loadSavedSearches = useCallback(async () => {
    try {
      const searches = await directoryService.getSavedSearches();
      setSavedSearches(searches);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  }, []);

  // Apply saved search
  const applySavedSearch = useCallback(
    async (search: SavedSearch) => {
      await searchDevelopers(search.search_params);
    },
    [searchDevelopers],
  );

  // Load watchlist
  const loadWatchlist = useCallback(async () => {
    try {
      const list = await directoryService.getWatchlist();
      setWatchlist(list);
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    }
  }, []);

  // Check if developer is in watchlist
  const checkWatchlistStatus = useCallback(async (developerId: string): Promise<boolean> => {
    try {
      return await directoryService.isInWatchlist(developerId);
    } catch (err) {
      console.error('Failed to check watchlist status:', err);
      return false;
    }
  }, []);

  const value: DirectoryContextValue = {
    searchResults,
    featuredDevelopers,
    filters,
    currentParams,
    savedSearches,
    watchlist,
    isLoading,
    error,
    searchDevelopers,
    loadFeaturedDevelopers,
    loadFilters,
    getDeveloperById,
    getSimilarDevelopers,
    updateSearchParams,
    clearFilters,
    trackDeveloperClick,
    loadSavedSearches,
    applySavedSearch,
    loadWatchlist,
    checkWatchlistStatus,
  };

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
};

export const useDirectory = (): DirectoryContextValue => {
  const context = useContext(DirectoryContext);
  if (!context) {
    throw new Error('useDirectory must be used within DirectoryProvider');
  }
  return context;
};
