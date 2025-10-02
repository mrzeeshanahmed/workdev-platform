import React, { createContext, useContext, useState, useCallback } from 'react';
import { marketplaceService } from '../services/MarketplaceService';
import type {
  ProjectSearchParams,
  ProjectCard,
  ProjectSearchResult,
  ProjectFilters,
} from '../types';

interface MarketplaceContextValue {
  // State
  searchResults: ProjectSearchResult | null;
  featuredProjects: ProjectCard[];
  filters: ProjectFilters | null;
  currentParams: ProjectSearchParams;
  isLoading: boolean;
  error: string | null;

  // Actions
  searchProjects: (params: ProjectSearchParams) => Promise<void>;
  loadFeaturedProjects: () => Promise<void>;
  loadFilters: () => Promise<void>;
  getProjectById: (projectId: string) => Promise<ProjectCard | null>;
  getSimilarProjects: (projectId: string) => Promise<ProjectCard[]>;
  updateSearchParams: (params: Partial<ProjectSearchParams>) => void;
  clearFilters: () => void;
  trackProjectClick: (projectId: string) => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchResults, setSearchResults] = useState<ProjectSearchResult | null>(null);
  const [featuredProjects, setFeaturedProjects] = useState<ProjectCard[]>([]);
  const [filters, setFilters] = useState<ProjectFilters | null>(null);
  const [currentParams, setCurrentParams] = useState<ProjectSearchParams>({
    page: 1,
    limit: 20,
    sort_by: 'newest',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProjects = useCallback(async (params: ProjectSearchParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await marketplaceService.searchProjects(params);
      setSearchResults(results);
      setCurrentParams(params);
    } catch (err: any) {
      setError(err.message || 'Failed to search projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFeaturedProjects = useCallback(async () => {
    try {
      const projects = await marketplaceService.getFeaturedProjects();
      setFeaturedProjects(projects);
    } catch (err: any) {
      console.error('Failed to load featured projects:', err);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const availableFilters = await marketplaceService.getAvailableFilters();
      setFilters(availableFilters);
    } catch (err: any) {
      console.error('Failed to load filters:', err);
    }
  }, []);

  const getProjectById = useCallback(async (projectId: string) => {
    try {
      const project = await marketplaceService.getProjectById(projectId);
      return project;
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
      return null;
    }
  }, []);

  const getSimilarProjects = useCallback(async (projectId: string) => {
    try {
      const projects = await marketplaceService.getSimilarProjects(projectId);
      return projects;
    } catch (err: any) {
      console.error('Failed to load similar projects:', err);
      return [];
    }
  }, []);

  const updateSearchParams = useCallback(
    (params: Partial<ProjectSearchParams>) => {
      const newParams = { ...currentParams, ...params };
      searchProjects(newParams);
    },
    [currentParams, searchProjects],
  );

  const clearFilters = useCallback(() => {
    const resetParams: ProjectSearchParams = {
      page: 1,
      limit: 20,
      sort_by: 'newest',
    };
    searchProjects(resetParams);
  }, [searchProjects]);

  const trackProjectClick = useCallback(async (projectId: string) => {
    try {
      await marketplaceService.trackProjectClick(projectId);
    } catch (err: any) {
      console.error('Failed to track click:', err);
    }
  }, []);

  const value: MarketplaceContextValue = {
    searchResults,
    featuredProjects,
    filters,
    currentParams,
    isLoading,
    error,
    searchProjects,
    loadFeaturedProjects,
    loadFilters,
    getProjectById,
    getSimilarProjects,
    updateSearchParams,
    clearFilters,
    trackProjectClick,
  };

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within MarketplaceProvider');
  }
  return context;
};

export default MarketplaceContext;
