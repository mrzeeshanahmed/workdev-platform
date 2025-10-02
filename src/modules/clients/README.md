# Client Profile and Two-Way Reputation System

A comprehensive client profile management system with a two-way review system that creates accountability for professional client behavior and helps developers identify quality clients.

## Overview

This module implements:

- **Client Profile Management**: Company information, branding, and professional details
- **Two-Way Review System**: Mutual accountability where both clients and developers review each other
- **Reputation Dashboard**: Transparent metrics showing client reliability and professionalism
- **Hiring History**: Complete project history with outcomes and payment records
- **Public Client Profiles**: Verifiable reputation for developer trust

## Key Features

### Client Profile Management

- **Company Information**
  - Company name, logo, website
  - Industry and company size
  - Location and description
  - Professional branding

- **Profile Editing**
  - Easy-to-use editor interface
  - Logo upload (2MB max, JPEG/PNG/WebP/SVG)
  - Real-time validation
  - Automatic profile updates

### Two-Way Review System

- **Mutual Review Requirements**
  - Both parties must complete project successfully
  - Payment must be completed
  - Each party submits their review
  - Reviews become visible only after both submit

- **Client Rating Criteria** (1-5 stars)
  - Communication
  - Professionalism
  - Project Clarity
  - Payment Timeliness

- **Developer Rating Criteria** (1-5 stars)
  - Communication
  - Professionalism
  - Work Quality
  - Technical Expertise
  - Responsiveness

- **Review Eligibility**
  - Automated eligibility checks
  - Project completion required
  - Payment verification
  - One review per project per user

### Reputation Dashboard

- **Overall Reputation Score**
  - Average rating (0-5 stars)
  - Total review count
  - Star distribution (5-star to 1-star breakdown)
  - Reputation level (Excellent, Very Good, Good, Fair, Needs Improvement)

- **Rating Breakdown**
  - Individual criteria scores
  - Visual rating displays
  - Trend indicators

- **Key Metrics**
  - Total projects posted
  - Successful hires count
  - Repeat hire rate percentage
  - Average project value

### Hiring History

- **Project Tracking**
  - All hired developers
  - Project titles and budgets
  - Hire and completion dates
  - Project status and outcome

- **Review Status**
  - Client review submitted indicator
  - Developer review submitted indicator
  - Review action buttons

- **Outcome Tracking**
  - Successful completions
  - Disputed projects
  - Cancelled projects

### Public Client Profiles

- **Visible Information**
  - Company details and branding
  - Member since date
  - Project statistics
  - Reputation metrics
  - Recent public reviews (with mutual consent)

- **Trust Verification**
  - Aggregated ratings only (privacy protected)
  - Review count transparency
  - Historical performance data

## Architecture

### Database Schema

```sql
-- Client Profiles
client_profiles (
  id, user_id, company_name, company_logo_url,
  company_website, company_description, industry,
  company_size, location, total_projects_posted,
  active_projects, successful_hires, repeat_hire_rate,
  average_rating, total_reviews, created_at, updated_at
)

-- Project Reviews (Two-Way)
project_reviews (
  id, project_id, reviewer_user_id, reviewer_type,
  reviewee_user_id, reviewee_type, rating_communication,
  rating_professionalism, rating_project_clarity,
  rating_payment_timeliness, rating_quality, rating_expertise,
  rating_responsiveness, comment, is_visible,
  is_mutual_visible, created_at, updated_at
)

-- Project Hires
project_hires (
  id, project_id, client_id, developer_id, hire_date,
  completion_date, status, outcome, final_amount_paid,
  created_at, updated_at
)
```

### Service Layer

**ClientService** provides:

- `getClientProfile()`: Fetch client profile
- `updateClientProfile()`: Update profile information
- `uploadCompanyLogo()`: Upload and store company logo
- `getPublicClientProfile()`: Get public-facing profile
- `getClientReputationStats()`: Calculate reputation metrics
- `getPublicReviews()`: Fetch visible reviews
- `checkReviewEligibility()`: Verify can submit review
- `submitProjectReview()`: Submit two-way review
- `getHiringHistory()`: Fetch project hire history
- `getClientReviews()`: Get all reviews for client

### React Components

1. **ClientProfileEditor**
   - Company information editing
   - Logo upload with preview
   - Industry and size selection
   - Form validation
   - Auto-save functionality

2. **ClientReputationDashboard**
   - Overall reputation score display
   - Star distribution visualization
   - Rating breakdown by criteria
   - Key metrics cards
   - Reputation level badge

3. **ReviewSubmissionDialog**
   - Review eligibility checking
   - Dynamic rating fields (client vs developer)
   - Comment submission
   - Mutual visibility notification
   - Form validation

4. **HiringHistoryTable**
   - Sortable project list
   - Developer information
   - Status and outcome indicators
   - Review status tracking
   - Review action buttons

### Context Provider

**ClientContext** manages:

- Client profile state
- Reputation statistics
- Hiring history
- Reviews data
- Loading and error states
- Service method wrappers

## Usage

### Setup

1. **Run Database Migration**

```bash
# Apply the migration
psql -U postgres -d your_database -f supabase/migrations/20250101_client_profiles_reviews.sql
```

2. **Import Module**

```typescript
import {
  ClientProvider,
  useClient,
  ClientProfileEditor,
  ClientReputationDashboard,
  HiringHistoryTable,
} from '@/modules/clients';
```

3. **Wrap App with Provider**

```typescript
<ClientProvider>
  <YourApp />
</ClientProvider>
```

### Client Profile Editing

```typescript
import { ClientProfileEditor } from '@/modules/clients';

function ProfilePage() {
  const userId = 'client-user-id';

  return (
    <ClientProfileEditor
      userId={userId}
      onSave={() => console.log('Profile saved!')}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

### Reputation Dashboard

```typescript
import { ClientReputationDashboard } from '@/modules/clients';

function ReputationPage() {
  const userId = 'client-user-id';

  return <ClientReputationDashboard userId={userId} />;
}
```

### Hiring History with Reviews

```typescript
import { HiringHistoryTable } from '@/modules/clients';

function HiringHistoryPage() {
  const clientId = 'client-user-id';

  return <HiringHistoryTable clientId={clientId} />;
}
```

### Submitting Reviews

```typescript
import { ReviewSubmissionDialog } from '@/modules/clients';

function ProjectCompletionPage() {
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setReviewOpen(true)}>
        Review Developer
      </Button>

      <ReviewSubmissionDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        projectId="project-id"
        projectTitle="E-commerce Platform"
        revieweeUserId="developer-id"
        revieweeName="John Developer"
        reviewerUserId="client-id"
        reviewType="developer"
      />
    </>
  );
}
```

### Using Service Directly

```typescript
import { clientService } from '@/modules/clients';

// Get public client profile
const publicProfile = await clientService.getPublicClientProfile('client-id');

// Check review eligibility
const eligibility = await clientService.checkReviewEligibility('project-id', 'reviewer-id');

// Submit review
const result = await clientService.submitProjectReview('reviewer-id', {
  project_id: 'project-id',
  reviewee_user_id: 'client-id',
  reviewee_type: 'client',
  rating_communication: 5,
  rating_professionalism: 5,
  rating_project_clarity: 4,
  rating_payment_timeliness: 5,
  comment: 'Great client, clear requirements and timely payments!',
});
```

## Business Logic

### Review Mutual Visibility

Reviews follow a mutual visibility model:

1. **Submission**: Either party submits their review first
   - Review is saved but marked as `is_mutual_visible = false`
   - Review is hidden from public view

2. **Second Submission**: Other party submits their review
   - Database trigger automatically sets `is_mutual_visible = true` for both reviews
   - Both reviews become publicly visible
   - Client reputation stats are updated

3. **Visibility Rules**
   - Private: Only reviewee and reviewer can see non-mutual reviews
   - Public: Everyone can see mutual reviews
   - Aggregated ratings always visible

### Review Eligibility Requirements

Users can review only when:

- ✅ Project status is "completed"
- ✅ Payment status is "paid"
- ✅ User is part of the project (client or developer)
- ✅ User hasn't already reviewed this project
- ❌ Cannot review if any condition fails

### Reputation Calculation

```typescript
// Overall Average = (Communication + Professionalism + Clarity + Timeliness) / 4
overall_rating = (
  avg(rating_communication) +
  avg(rating_professionalism) +
  avg(rating_project_clarity) +
  avg(rating_payment_timeliness)
) / 4

// Star Distribution
5-star count = reviews with avg >= 4.5
4-star count = reviews with avg >= 3.5 and < 4.5
// ... etc

// Repeat Hire Rate
repeat_hire_rate = (
  (total_hires - unique_developers) / total_hires
) * 100
```

## Security

### Row Level Security (RLS)

- **Client Profiles**: Viewable by all, editable by owner only
- **Project Reviews**: Viewable if mutual, always viewable by involved parties
- **Project Hires**: Viewable by client and hired developer only

### Storage Policies

- **Company Logos**: Public read, upload/update/delete by owner only
- **File Validation**: Max 2MB, allowed types: JPEG, PNG, WebP, SVG
- **Path Security**: Logos stored in user-specific folders

### Data Privacy

- **Aggregated Data**: Always public (average ratings, counts)
- **Review Details**: Private until both parties submit
- **Personal Information**: Protected by RLS policies

## Performance Considerations

### Database Indexes

```sql
-- Fast client lookups
idx_client_profiles_user_id
idx_client_profiles_average_rating

-- Efficient review queries
idx_reviews_reviewee
idx_reviews_project
idx_reviews_mutual_visible
idx_reviews_project_reviewee

-- Hiring history optimization
idx_hires_client
idx_hires_developer
idx_hires_project
idx_hires_status
idx_hires_client_status
idx_hires_completion_date
```

### Automated Triggers

- **Mutual Review Detection**: Trigger automatically updates visibility
- **Reputation Stats**: Trigger recalculates client metrics on new reviews
- **No Manual Updates**: All aggregations handled by database

### Caching Strategy

- Client profiles cached in React context
- Reputation stats refreshed on review submission
- Public profiles can be cached client-side (1 hour TTL)

## Error Handling

### Client-Side

```typescript
try {
  await clientService.submitProjectReview(userId, reviewData);
} catch (error) {
  if (error.message.includes('not completed')) {
    // Show project not completed error
  } else if (error.message.includes('already reviewed')) {
    // Show already reviewed error
  } else {
    // Generic error handling
  }
}
```

### Database-Side

- Unique constraints prevent duplicate reviews
- Check constraints validate rating ranges (1-5)
- Foreign key constraints maintain referential integrity
- RLS policies enforce security automatically

## Monitoring

### Key Metrics to Track

- Average review submission rate
- Time between project completion and review
- Percentage of mutual reviews vs single reviews
- Client reputation distribution
- Review dispute rate

### Analytics Queries

```sql
-- Average time to review
SELECT AVG(
  EXTRACT(EPOCH FROM (pr.created_at - ph.completion_date)) / 86400
) as avg_days_to_review
FROM project_reviews pr
JOIN project_hires ph ON pr.project_id = ph.project_id;

-- Client reputation distribution
SELECT
  CASE
    WHEN average_rating >= 4.5 THEN 'Excellent'
    WHEN average_rating >= 4.0 THEN 'Very Good'
    WHEN average_rating >= 3.5 THEN 'Good'
    ELSE 'Fair'
  END as reputation_level,
  COUNT(*) as client_count
FROM client_profiles
GROUP BY reputation_level;
```

## Testing

### Unit Tests

```typescript
// Test review eligibility
test('should allow review after project completion and payment', async () => {
  const eligibility = await clientService.checkReviewEligibility(completedProjectId, clientId);
  expect(eligibility.can_review).toBe(true);
});

// Test mutual visibility
test('should make reviews visible after both submit', async () => {
  await clientService.submitProjectReview(clientId, clientReviewData);
  await clientService.submitProjectReview(developerId, devReviewData);

  const reviews = await clientService.getPublicReviews(clientId);
  expect(reviews.length).toBeGreaterThan(0);
});
```

### Integration Tests

- Test complete review flow (eligibility → submit → visibility)
- Test reputation calculation accuracy
- Test hiring history updates
- Test logo upload and storage

## Future Enhancements

- [ ] Review response system (reply to reviews)
- [ ] Review flagging for inappropriate content
- [ ] Verified badge for highly-rated clients
- [ ] Email notifications for review requests
- [ ] Review reminder automation
- [ ] Advanced analytics dashboard
- [ ] Review export functionality
- [ ] Dispute resolution workflow
- [ ] Payment verification integration
- [ ] Client certification program

## Troubleshooting

### Issue: Reviews not becoming visible

**Solution**: Verify both parties have submitted reviews and check `is_mutual_visible` flag.

```sql
SELECT * FROM project_reviews
WHERE project_id = 'your-project-id';
```

### Issue: Reputation stats not updating

**Solution**: Manually trigger stats update:

```sql
SELECT update_client_profile_stats('client-user-id');
```

### Issue: Cannot upload logo

**Solution**: Check storage bucket policies and file size/type:

```typescript
// Verify bucket exists
const { data: buckets } = await supabase.storage.listBuckets();
console.log(buckets);

// Check file constraints
console.log(`File size: ${file.size / 1024 / 1024} MB`);
console.log(`File type: ${file.type}`);
```

## Contributing

When adding features to this module:

1. Update types in `types.ts`
2. Add service methods in `ClientService.ts`
3. Create/update React components
4. Update context provider if needed
5. Add database migrations
6. Update this README
7. Add tests for new functionality

## License

Part of the WorkDev platform. See main LICENSE file.
