// Types
export type {
  ProjectSearchParams,
  ProjectCard as ProjectCardData,
  ProjectSearchResult,
  ProjectFilters,
  FilterOption,
  BudgetRange,
  ProjectTypeOption,
  DurationOption,
  FeaturedProject,
  SearchAnalytics,
  ProjectSkill,
  SortOption,
} from './types';

export { PROJECT_TYPES, DURATION_OPTIONS, BUDGET_RANGES, SORT_OPTIONS } from './types';

// Services
export { MarketplaceService, marketplaceService } from './services/MarketplaceService';

// Context
export { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';

// Components
export { ProjectCard, SearchBar, FilterSidebar, MarketplaceGrid } from './components';

// Pages (legacy)
export { default as MarketplaceHome } from './pages/MarketplaceHome';
