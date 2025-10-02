# Project Marketplace Module

A comprehensive project marketplace system with advanced full-text search, multi-criteria filtering, featured projects, and search analytics.

## Features

### 🔍 Full-Text Search

- **PostgreSQL tsvector** with GIN indexing for fast searches
- **Weighted ranking**: Title (A), Description (B), Location (C)
- **Websearch mode**: Support for phrases, AND/OR operators
- **Debounced input**: 500ms delay to reduce API calls
- **Autocomplete**: Real-time skill suggestions with 300ms debounce
- **Target performance**: Sub-500ms query response time

### 🎯 Advanced Filtering

- **Skills**: Array containment filtering with autocomplete
- **Budget Range**: Min/max slider (0-100k)
- **Project Type**: Fixed price or hourly rate
- **Duration**: Short (< 1 month), Medium (1-3 months), Long (3+ months)
- **Location**: Text-based search with ILIKE
- **Remote Only**: Boolean flag filter
- **Combined filters**: All criteria can be applied simultaneously

### ⭐ Featured Projects

- **Premium placement**: Featured projects displayed prominently
- **Impression tracking**: Automatic view counting
- **Click tracking**: Analytics on featured project engagement
- **Expiration system**: Automatic expiry based on `featured_until` date
- **Badge display**: Visual distinction with featured badge

### 📊 Search Analytics

- **Query tracking**: Store search queries and filters
- **Results metrics**: Track result counts and response times
- **Click tracking**: Monitor which projects get clicked
- **Performance analysis**: Identify slow queries
- **JSONB filters**: Store complex filter combinations

### 🎨 UI Components

- **Responsive grid**: 3-column layout (desktop), 2-column (tablet), 1-column (mobile)
- **Material-UI v5**: Modern design with consistent theme
- **Skeleton loading**: Smooth loading states
- **Empty states**: Helpful messages when no results
- **Pagination**: Configurable page size with total pages
- **Sort controls**: Multiple sorting options

## Database Schema

### Tables

#### `projects`

Main projects table with full-text search support.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(10, 2),
  project_type project_type_enum NOT NULL, -- 'fixed' | 'hourly'
  duration duration_enum, -- 'short' | 'medium' | 'long'
  location TEXT,
  is_remote_ok BOOLEAN DEFAULT false,
  deadline TIMESTAMPTZ,
  status project_status_enum DEFAULT 'open', -- 'open' | 'in_progress' | 'completed' | 'cancelled'
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMPTZ,
  views_count INTEGER DEFAULT 0,
  proposals_count INTEGER DEFAULT 0,
  search_vector TSVECTOR, -- Generated column for full-text search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**

- `idx_projects_search` (GIN on search_vector) - Full-text search
- `idx_projects_status` - Filter by status
- `idx_projects_featured` - Featured projects queries
- `idx_projects_created_at` - Sorting by date
- `idx_projects_budget` - Budget range filtering
- `idx_projects_deadline` - Deadline sorting
- `idx_projects_type` - Project type filtering
- `idx_projects_location` - Location searches

#### `project_skills`

Junction table for project-skill relationships.

```sql
CREATE TABLE project_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, skill_name)
);
```

#### `featured_projects`

Tracks impressions and clicks for featured projects.

```sql
CREATE TABLE featured_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  last_impression_at TIMESTAMPTZ,
  last_click_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `search_analytics`

Stores search queries and performance metrics.

```sql
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT,
  filters JSONB, -- Stores filter combinations
  results_count INTEGER,
  search_time_ms INTEGER,
  clicked_project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Views

#### `marketplace_projects`

Materialized view joining projects with client and skill data.

```sql
CREATE VIEW marketplace_projects AS
SELECT
  p.*,
  cp.company_name as client_company,
  cp.first_name || ' ' || cp.last_name as client_name,
  cp.avatar_url as client_avatar,
  cp.average_rating as client_rating,
  COALESCE(array_agg(ps.skill_name) FILTER (WHERE ps.skill_name IS NOT NULL), ARRAY[]::TEXT[]) as skills
FROM projects p
LEFT JOIN client_profiles cp ON p.client_id = cp.user_id
LEFT JOIN project_skills ps ON p.project_id = ps.project_id
GROUP BY p.id, cp.company_name, cp.first_name, cp.last_name, cp.avatar_url, cp.average_rating;
```

### Functions

#### `update_project_search_vector()`

Trigger function to automatically update search vector on insert/update.

```sql
CREATE OR REPLACE FUNCTION update_project_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### `increment_project_views(project_id UUID)`

Increments view count for a project.

#### `increment_featured_impression(project_id UUID)`

Tracks featured project impressions.

#### `increment_featured_click(project_id UUID)`

Tracks featured project clicks.

#### `expire_featured_projects()`

Called by cron to expire featured projects.

#### `get_popular_skills(limit_count INTEGER)`

Returns most used skills across all projects.

## Service Layer

### MarketplaceService

Singleton service class for all marketplace operations.

```typescript
import { marketplaceService } from '@/modules/marketplace';

// Search projects
const result = await marketplaceService.searchProjects({
  query: 'react developer',
  skills: ['React', 'TypeScript'],
  project_type: 'fixed',
  budget_min: 1000,
  budget_max: 5000,
  duration: 'medium',
  location: 'New York',
  is_remote_ok: true,
  sort: 'newest',
  page: 1,
  limit: 12,
});

// Get featured projects
const featured = await marketplaceService.getFeaturedProjects(6);

// Get project by ID
const project = await marketplaceService.getProjectById('uuid');

// Get similar projects
const similar = await marketplaceService.getSimilarProjects('uuid', 5);

// Get available filters
const filters = await marketplaceService.getAvailableFilters();

// Get skill suggestions for autocomplete
const skills = await marketplaceService.getSkillSuggestions('reac');

// Track analytics
await marketplaceService.trackSearchAnalytics(params, results.total, 350);
await marketplaceService.trackProjectClick('uuid');

// Client operations
await marketplaceService.createProject(projectData);
await marketplaceService.updateProject('uuid', updates);
await marketplaceService.deleteProject('uuid');
await marketplaceService.featureProject('uuid', expirationDate);
```

### Key Methods

#### `searchProjects(params: ProjectSearchParams): Promise<ProjectSearchResult>`

Main search method with all filtering and sorting capabilities.

**Parameters:**

- `query`: Full-text search string (optional)
- `skills`: Array of skill names to filter (optional)
- `project_type`: 'fixed' | 'hourly' (optional)
- `budget_min`: Minimum budget (optional)
- `budget_max`: Maximum budget (optional)
- `duration`: 'short' | 'medium' | 'long' (optional)
- `location`: Location string (ILIKE search, optional)
- `is_remote_ok`: Boolean flag (optional)
- `sort`: 'newest' | 'budget_high' | 'budget_low' | 'deadline' | 'relevance' (default: 'relevance')
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 12)

**Returns:**

```typescript
{
  projects: ProjectCard[],
  total: number,
  page: number,
  limit: number,
  total_pages: number,
}
```

#### `getFeaturedProjects(limit?: number): Promise<ProjectCard[]>`

Fetches currently featured projects (featured_until > NOW).

#### `getProjectById(id: string): Promise<ProjectCard | null>`

Retrieves a single project and increments its view count.

#### `getSimilarProjects(projectId: string, limit?: number): Promise<ProjectCard[]>`

Finds projects with overlapping skills.

#### `getAvailableFilters(): Promise<ProjectFilters>`

Returns popular skills, budget ranges, and unique locations.

#### `getSkillSuggestions(query: string): Promise<string[]>`

Autocomplete suggestions for skill input.

#### `trackSearchAnalytics(params, resultsCount, searchTimeMs): Promise<void>`

Non-blocking analytics tracking.

#### `trackProjectClick(projectId: string): Promise<void>`

Tracks clicks and featured project impressions.

## React Context

### MarketplaceProvider

Global state management for marketplace.

```typescript
import { MarketplaceProvider, useMarketplace } from '@/modules/marketplace';

function App() {
  return (
    <MarketplaceProvider>
      <MarketplacePage />
    </MarketplaceProvider>
  );
}

function MarketplacePage() {
  const {
    // State
    searchResults,
    featuredProjects,
    filters,
    currentParams,
    isLoading,
    error,

    // Actions
    searchProjects,
    loadFeaturedProjects,
    loadFilters,
    getProjectById,
    getSimilarProjects,
    updateSearchParams,
    clearFilters,
    trackProjectClick,
  } = useMarketplace();

  // Use the context...
}
```

### Context State

```typescript
interface MarketplaceContextValue {
  // Current search results
  searchResults: ProjectSearchResult | null;

  // Featured projects
  featuredProjects: ProjectCard[];

  // Available filters (popular skills, locations)
  filters: ProjectFilters | null;

  // Current search parameters
  currentParams: ProjectSearchParams;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  searchProjects: (params: Partial<ProjectSearchParams>) => Promise<void>;
  loadFeaturedProjects: () => Promise<void>;
  loadFilters: () => Promise<void>;
  getProjectById: (id: string) => Promise<ProjectCard | null>;
  getSimilarProjects: (id: string, limit?: number) => Promise<ProjectCard[]>;
  updateSearchParams: (params: Partial<ProjectSearchParams>) => void;
  clearFilters: () => void;
  trackProjectClick: (projectId: string) => Promise<void>;
}
```

## Components

### MarketplaceGrid

Main marketplace layout component.

```typescript
import { MarketplaceGrid } from '@/modules/marketplace';

function MarketplacePage() {
  return <MarketplaceGrid />;
}
```

**Features:**

- Search bar with autocomplete
- Filter sidebar (drawer on mobile)
- Featured projects section
- Results grid with pagination
- Sort controls
- Loading states
- Error handling
- Empty state messages

### ProjectCard

Individual project display component.

```typescript
import { ProjectCard } from '@/modules/marketplace';

<ProjectCard
  project={projectData}
  onClick={() => navigate(`/projects/${project.id}`)}
  onViewDetails={(id) => handleViewDetails(id)}
/>
```

**Props:**

- `project`: ProjectCard data object
- `onClick`: Click handler (optional)
- `onViewDetails`: View details handler (optional)

**Features:**

- Featured badge for premium listings
- Budget formatting ($1k or $1,000)
- Skills chips (max 5 + overflow)
- Client info with avatar and rating
- Location and remote indicator
- Proposals count
- Days ago calculation
- Responsive hover effects

### SearchBar

Search input with skill filtering.

```typescript
import { SearchBar } from '@/modules/marketplace';

<SearchBar onToggleFilters={() => setFiltersOpen(true)} />
```

**Props:**

- `onToggleFilters`: Callback to open filter sidebar (optional)

**Features:**

- Full-text search input with icon
- Skills autocomplete (freeSolo + multiple)
- Active filters summary
- Clear buttons
- Debounced search (500ms)
- Loading indicators

### FilterSidebar

Advanced filtering drawer.

```typescript
import { FilterSidebar } from '@/modules/marketplace';

<FilterSidebar open={isOpen} onClose={() => setIsOpen(false)} />
```

**Props:**

- `open`: Drawer open state
- `onClose`: Close callback

**Features:**

- Project type radio buttons
- Duration radio buttons
- Budget range slider (0-100k)
- Location input
- Remote only checkbox
- Active filters count badge
- Clear all button
- Real-time filter updates

## Usage Examples

### Basic Implementation

```typescript
import { MarketplaceProvider, MarketplaceGrid } from '@/modules/marketplace';

function App() {
  return (
    <MarketplaceProvider>
      <MarketplaceGrid />
    </MarketplaceProvider>
  );
}
```

### Custom Implementation

```typescript
import { useMarketplace, ProjectCard, SearchBar, FilterSidebar } from '@/modules/marketplace';
import { Grid, Container } from '@mui/material';

function CustomMarketplace() {
  const { searchResults, isLoading, searchProjects } = useMarketplace();
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    searchProjects({});
  }, []);

  return (
    <Container>
      <SearchBar onToggleFilters={() => setFiltersOpen(true)} />
      <FilterSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />

      <Grid container spacing={3}>
        {searchResults?.projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <ProjectCard
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
```

### Search with Filters

```typescript
const { searchProjects } = useMarketplace();

// Simple search
await searchProjects({ query: 'react developer' });

// Search with skills
await searchProjects({
  query: 'web development',
  skills: ['React', 'TypeScript', 'Node.js'],
});

// Budget range filter
await searchProjects({
  budget_min: 1000,
  budget_max: 5000,
  project_type: 'fixed',
});

// Location filter
await searchProjects({
  location: 'New York',
  is_remote_ok: true,
});

// Combined filters
await searchProjects({
  query: 'mobile app',
  skills: ['React Native', 'iOS'],
  project_type: 'hourly',
  duration: 'medium',
  budget_min: 2000,
  budget_max: 10000,
  location: 'San Francisco',
  is_remote_ok: false,
  sort: 'budget_high',
});
```

### Pagination

```typescript
const { searchResults, updateSearchParams } = useMarketplace();

function handlePageChange(page: number) {
  updateSearchParams({ page });
}

<Pagination
  count={searchResults?.total_pages || 0}
  page={searchResults?.page || 1}
  onChange={(_, page) => handlePageChange(page)}
/>
```

### Sort Options

```typescript
const { updateSearchParams } = useMarketplace();

<Select
  value={currentSort}
  onChange={(e) => updateSearchParams({ sort: e.target.value })}
>
  <MenuItem value="newest">Newest First</MenuItem>
  <MenuItem value="budget_high">Highest Budget</MenuItem>
  <MenuItem value="budget_low">Lowest Budget</MenuItem>
  <MenuItem value="deadline">Urgent (Deadline)</MenuItem>
  <MenuItem value="relevance">Most Relevant</MenuItem>
</Select>
```

## Performance Optimization

### Database Level

1. **GIN Index on search_vector**: Fast full-text searches
2. **B-tree indexes**: Efficient filtering and sorting
3. **Array containment operator**: Fast skill filtering with `@>`
4. **Materialized views**: Pre-computed joins (optional, commented out in migration)
5. **Query planning**: Use EXPLAIN ANALYZE to optimize slow queries

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM marketplace_projects
WHERE search_vector @@ websearch_to_tsquery('english', 'react developer')
AND 'React' = ANY(skills)
AND budget BETWEEN 1000 AND 5000;
```

### Application Level

1. **Debouncing**: 500ms for search, 300ms for skills
2. **Pagination**: Range-based queries with configurable limits
3. **Async analytics**: Non-blocking tracking
4. **useCallback hooks**: Stable function references
5. **Lazy loading**: Components load data only when needed

### Monitoring

Track search performance in `search_analytics` table:

```sql
-- Find slow queries
SELECT query, AVG(search_time_ms) as avg_time, COUNT(*) as count
FROM search_analytics
GROUP BY query
HAVING AVG(search_time_ms) > 500
ORDER BY avg_time DESC;

-- Popular search terms
SELECT query, COUNT(*) as search_count
FROM search_analytics
WHERE query IS NOT NULL
GROUP BY query
ORDER BY search_count DESC
LIMIT 20;

-- Click-through rate for featured projects
SELECT
  fp.project_id,
  fp.impressions_count,
  fp.clicks_count,
  ROUND((fp.clicks_count::NUMERIC / NULLIF(fp.impressions_count, 0)) * 100, 2) as ctr
FROM featured_projects fp
ORDER BY ctr DESC;
```

## Troubleshooting

### Search Returns No Results

1. **Check search vector**: Ensure it's generated correctly

   ```sql
   SELECT title, search_vector FROM projects LIMIT 5;
   ```

2. **Test search query**:

   ```sql
   SELECT * FROM projects
   WHERE search_vector @@ websearch_to_tsquery('english', 'your query here');
   ```

3. **Verify status filter**: Only 'open' projects are returned by default

### Slow Search Performance

1. **Check indexes**:

   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'projects';
   ```

2. **Analyze query plan**:

   ```sql
   EXPLAIN ANALYZE <your_query>;
   ```

3. **Reduce result set**: Use stricter filters or lower page limits

4. **Check analytics**: Monitor `search_time_ms` in `search_analytics`

### Skills Not Filtering Correctly

1. **Verify junction table**:

   ```sql
   SELECT * FROM project_skills WHERE project_id = 'your-uuid';
   ```

2. **Test array containment**:

   ```sql
   SELECT * FROM marketplace_projects
   WHERE skills @> ARRAY['React']::TEXT[];
   ```

3. **Check skill names**: Skills are case-sensitive

### Featured Projects Not Showing

1. **Check expiration**:

   ```sql
   SELECT id, title, is_featured, featured_until
   FROM projects
   WHERE is_featured = true;
   ```

2. **Verify featured_projects table**:

   ```sql
   SELECT * FROM featured_projects;
   ```

3. **Check RLS policies**: Ensure user has read access

## Deployment

### 1. Run Database Migration

```bash
# PostgreSQL
psql -U postgres -d workdev_db -f supabase/migrations/20250101_project_marketplace.sql

# Supabase CLI
supabase db push
```

### 2. Verify Schema

```sql
-- Check tables
\dt projects project_skills featured_projects search_analytics

-- Check indexes
SELECT tablename, indexname FROM pg_indexes WHERE tablename IN ('projects', 'project_skills');

-- Check functions
\df update_project_search_vector increment_project_views expire_featured_projects
```

### 3. Seed Test Data (Optional)

```sql
-- Insert test project
INSERT INTO projects (client_id, title, description, budget, project_type, duration, location, is_remote_ok)
VALUES ('your-user-uuid', 'React Developer Needed', 'Build a modern web application...', 5000, 'fixed', 'medium', 'New York', true);

-- Add skills
INSERT INTO project_skills (project_id, skill_name)
VALUES ('project-uuid', 'React'), ('project-uuid', 'TypeScript');

-- Feature project
UPDATE projects SET is_featured = true, featured_until = NOW() + INTERVAL '30 days' WHERE id = 'project-uuid';
```

### 4. Set Up Cron Job (Optional)

For automatic featured project expiration:

```sql
-- Supabase Edge Function or pg_cron
SELECT cron.schedule('expire-featured-projects', '0 0 * * *', 'SELECT expire_featured_projects()');
```

### 5. Environment Variables

No additional environment variables required - uses existing Supabase configuration.

### 6. Build and Deploy

```bash
npm run build
npm run deploy
```

## Testing Checklist

- [ ] Full-text search returns relevant results
- [ ] Skills filter works with multiple selections
- [ ] Budget range slider filters correctly
- [ ] Project type filter (fixed/hourly)
- [ ] Duration filter (short/medium/long)
- [ ] Location search works (ILIKE)
- [ ] Remote only checkbox filters correctly
- [ ] Combined filters work together
- [ ] Sort options produce correct order
- [ ] Pagination displays correct results
- [ ] Featured projects show badge
- [ ] Featured projects track impressions
- [ ] Click tracking works
- [ ] Search analytics records queries
- [ ] View count increments
- [ ] Debouncing reduces API calls
- [ ] Loading states display correctly
- [ ] Error states handle gracefully
- [ ] Empty state shows helpful message
- [ ] Mobile responsive layout
- [ ] Search performance < 500ms

## API Reference

See TypeScript type definitions in `types.ts` for complete interface documentation.

## License

MIT
