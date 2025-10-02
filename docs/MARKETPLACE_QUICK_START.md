# Project Marketplace - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Run Database Migration

```bash
# Option A: Supabase CLI
supabase db push

# Option B: Direct PostgreSQL
psql -U postgres -d workdev_db -f supabase/migrations/20250101_project_marketplace.sql
```

### 2. Import and Use

```typescript
// In your app
import { MarketplaceProvider, MarketplaceGrid } from '@/modules/marketplace';

function App() {
  return (
    <MarketplaceProvider>
      <MarketplaceGrid />
    </MarketplaceProvider>
  );
}
```

### 3. Done! 🎉

Your marketplace is now live with full-text search, filtering, and featured projects.

---

## 📖 Common Use Cases

### Basic Search

```typescript
import { useMarketplace } from '@/modules/marketplace';

const { searchProjects } = useMarketplace();

// Simple text search
await searchProjects({ query: 'react developer' });

// Search with skills
await searchProjects({
  query: 'web development',
  skills: ['React', 'TypeScript'],
});
```

### Filter by Budget

```typescript
await searchProjects({
  budget_min: 1000,
  budget_max: 5000,
  project_type: 'fixed',
});
```

### Get Featured Projects

```typescript
const { loadFeaturedProjects, featuredProjects } = useMarketplace();

await loadFeaturedProjects();
// featuredProjects array now contains featured listings
```

### Track Project Click

```typescript
const { trackProjectClick } = useMarketplace();

// When user clicks a project
await trackProjectClick(projectId);
// Automatically tracks featured impressions and analytics
```

---

## 🎨 Custom Components

### Use Individual Components

```typescript
import {
  SearchBar,
  FilterSidebar,
  ProjectCard
} from '@/modules/marketplace';

function MyCustomMarketplace() {
  return (
    <>
      <SearchBar />
      <FilterSidebar open={isOpen} onClose={handleClose} />
      <Grid container spacing={3}>
        {projects.map(project => (
          <Grid item xs={12} md={4} key={project.id}>
            <ProjectCard
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          </Grid>
        ))}
      </Grid>
    </>
  );
}
```

---

## 🔍 Search Capabilities

### Full-Text Search Syntax

```typescript
// Simple terms
searchProjects({ query: 'react developer' });

// Phrases (use quotes)
searchProjects({ query: '"senior developer"' });

// AND operator
searchProjects({ query: 'react AND typescript' });

// OR operator
searchProjects({ query: 'react OR vue' });

// Negation
searchProjects({ query: 'developer -junior' });
```

### Available Filters

- **Skills**: `skills: ['React', 'TypeScript']`
- **Budget Range**: `budget_min: 1000, budget_max: 5000`
- **Project Type**: `project_type: 'fixed' | 'hourly'`
- **Duration**: `duration: 'short' | 'medium' | 'long'`
- **Location**: `location: 'New York'`
- **Remote**: `is_remote_ok: true`

### Sort Options

- `sort: 'newest'` - Most recent first
- `sort: 'budget_high'` - Highest budget first
- `sort: 'budget_low'` - Lowest budget first
- `sort: 'deadline'` - Urgent deadlines first
- `sort: 'relevance'` - Featured + newest (default)

---

## 📊 Analytics Queries

### Find Popular Searches

```sql
SELECT query, COUNT(*) as count
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY count DESC
LIMIT 10;
```

### Check Search Performance

```sql
SELECT
  AVG(search_time_ms) as avg_time,
  MAX(search_time_ms) as max_time,
  COUNT(*) as total_searches
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '1 day';
```

### Featured Projects CTR

```sql
SELECT
  p.title,
  fp.impressions_count,
  fp.clicks_count,
  ROUND((fp.clicks_count::NUMERIC / NULLIF(fp.impressions_count, 0)) * 100, 2) as ctr
FROM featured_projects fp
JOIN projects p ON p.id = fp.project_id
ORDER BY ctr DESC;
```

---

## 🛠️ Service Methods Reference

### Search & Retrieval

```typescript
import { marketplaceService } from '@/modules/marketplace';

// Search projects
const results = await marketplaceService.searchProjects(params);

// Get featured projects
const featured = await marketplaceService.getFeaturedProjects(6);

// Get single project
const project = await marketplaceService.getProjectById(id);

// Get similar projects
const similar = await marketplaceService.getSimilarProjects(id, 5);
```

### Filter Options

```typescript
// Get available filters
const filters = await marketplaceService.getAvailableFilters();
// Returns: { skills, budget_ranges, locations }

// Get skill suggestions
const skills = await marketplaceService.getSkillSuggestions('reac');
// Returns: ['React', 'React Native', ...]
```

### Client Operations

```typescript
// Create project
await marketplaceService.createProject({
  title: 'React Developer Needed',
  description: '...',
  budget: 5000,
  project_type: 'fixed',
  // ... other fields
});

// Update project
await marketplaceService.updateProject(id, { budget: 6000 });

// Delete project
await marketplaceService.deleteProject(id);

// Feature project
await marketplaceService.featureProject(id, expirationDate);
```

---

## 🎯 Context API Reference

### Available State

```typescript
const {
  // State
  searchResults, // Current paginated results
  featuredProjects, // Array of featured projects
  filters, // Available filter options
  currentParams, // Current search parameters
  isLoading, // Loading state
  error, // Error message (if any)

  // Actions
  searchProjects, // Search with params
  loadFeaturedProjects, // Load featured
  loadFilters, // Load filter options
  getProjectById, // Get single project
  getSimilarProjects, // Get recommendations
  updateSearchParams, // Update and re-search
  clearFilters, // Reset filters
  trackProjectClick, // Track click event
} = useMarketplace();
```

### Example Usage

```typescript
function MyComponent() {
  const {
    searchResults,
    isLoading,
    updateSearchParams
  } = useMarketplace();

  // Update filters
  const handleSkillChange = (skills: string[]) => {
    updateSearchParams({ skills, page: 1 });
  };

  // Change page
  const handlePageChange = (page: number) => {
    updateSearchParams({ page });
  };

  // Change sort
  const handleSortChange = (sort: string) => {
    updateSearchParams({ sort, page: 1 });
  };

  if (isLoading) return <CircularProgress />;

  return (
    <div>
      {searchResults?.projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### No Search Results

```sql
-- Check if projects exist
SELECT COUNT(*) FROM projects WHERE status = 'open';

-- Check search vector
SELECT title, search_vector FROM projects LIMIT 5;

-- Test search manually
SELECT * FROM projects
WHERE search_vector @@ websearch_to_tsquery('english', 'your query');
```

### Slow Searches

```sql
-- Check indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'projects';

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM marketplace_projects
WHERE search_vector @@ websearch_to_tsquery('english', 'test');

-- If slow, reindex
REINDEX TABLE projects;
```

### Skills Not Filtering

```sql
-- Check project_skills table
SELECT ps.skill_name, COUNT(*)
FROM project_skills ps
GROUP BY ps.skill_name
ORDER BY COUNT(*) DESC;

-- Test skills filter
SELECT * FROM marketplace_projects
WHERE skills @> ARRAY['React']::TEXT[];
```

---

## 📝 Type Definitions

### ProjectSearchParams

```typescript
interface ProjectSearchParams {
  query?: string; // Full-text search
  skills?: string[]; // Skills filter
  project_type?: 'fixed' | 'hourly'; // Project type
  budget_min?: number; // Min budget
  budget_max?: number; // Max budget
  duration?: 'short' | 'medium' | 'long'; // Duration
  location?: string; // Location text
  is_remote_ok?: boolean; // Remote flag
  sort?: 'newest' | 'budget_high' | 'budget_low' | 'deadline' | 'relevance';
  page?: number; // Page number (default: 1)
  limit?: number; // Results per page (default: 12)
}
```

### ProjectCard

```typescript
interface ProjectCard {
  id: string;
  title: string;
  description: string;
  budget: number;
  project_type: 'fixed' | 'hourly';
  duration?: 'short' | 'medium' | 'long';
  location?: string;
  is_remote_ok: boolean;
  deadline?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  is_featured: boolean;
  views_count: number;
  proposals_count: number;
  created_at: string;
  // Client info
  client_id: string;
  client_company?: string;
  client_name?: string;
  client_avatar?: string;
  client_rating: number;
  // Skills
  skills: string[];
}
```

---

## 🚀 Performance Tips

1. **Use Debouncing**: Already implemented (500ms for search, 300ms for skills)
2. **Limit Results**: Default is 12 per page, adjust as needed
3. **Use Indexes**: All necessary indexes are in place
4. **Monitor Analytics**: Check `search_analytics` for slow queries
5. **Cache Featured**: Featured projects change rarely, cache on client
6. **Lazy Load**: Implement infinite scroll for large result sets (future)

---

## 📚 Full Documentation

- **Complete README**: `src/modules/marketplace/README.md`
- **Implementation Summary**: `docs/MARKETPLACE_IMPLEMENTATION_SUMMARY.md`
- **Completion Report**: `docs/MARKETPLACE_COMPLETION_REPORT.md`

---

## ✅ Production Checklist

- [ ] Database migration applied
- [ ] Indexes verified
- [ ] RLS policies enabled
- [ ] Test data seeded (optional)
- [ ] Components imported in app
- [ ] Environment variables set
- [ ] Build successful
- [ ] Performance tested (< 500ms)
- [ ] Mobile responsive verified
- [ ] Analytics tracking confirmed

---

## 🎉 You're Ready!

Your project marketplace is production-ready with:

- ✅ Full-text search
- ✅ Advanced filtering
- ✅ Featured projects
- ✅ Search analytics
- ✅ Responsive UI
- ✅ Performance optimized

**Deploy with confidence!** 🚀
