# Budget Estimation System - Deployment Configuration

## Quick Start Deployment

This guide provides step-by-step instructions for deploying the Budget Estimation System to production.

---

## Prerequisites

- [ ] PostgreSQL 14+ database (Supabase or self-hosted)
- [ ] Python 3.11+ environment for ML service
- [ ] Node.js 18+ for React app
- [ ] Docker (optional, for containerized deployment)
- [ ] Supabase CLI (for Edge Functions)
- [ ] At least 100 completed projects for initial model training

---

## Part 1: Database Setup

### Step 1.1: Run Migration

```bash
# Connect to your database
psql -h your-db-host -U postgres -d workdev

# Or via Supabase CLI
supabase db reset

# Run the budget estimation migration
\i supabase/migrations/20251001_budget_estimation.sql
```

### Step 1.2: Verify Tables Created

```sql
-- Check tables
\dt

-- Should see:
-- historical_project_budgets
-- budget_estimations
-- market_rate_data
-- estimation_accuracy_tracking
-- ml_budget_models
```

### Step 1.3: Verify Functions Created

```sql
-- Check functions
\df get_similar_historical_projects
\df get_market_rates_for_skills
\df record_budget_estimation
\df update_estimation_accuracy
\df get_model_performance_summary
\df get_budget_statistics_by_type
```

### Step 1.4: Create Retraining Log Table

```sql
CREATE TABLE IF NOT EXISTS model_retraining_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  training_samples INTEGER NOT NULL,
  training_duration_ms INTEGER NOT NULL,
  performance_metrics JSONB NOT NULL,
  performance_improvement DECIMAL(5, 4) NOT NULL,
  deployed BOOLEAN NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('deployed', 'not_deployed', 'failed')),
  message TEXT,
  retrained_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_retraining_log_version ON model_retraining_log (model_version);
CREATE INDEX idx_retraining_log_date ON model_retraining_log (retrained_at DESC);
```

### Step 1.5: Seed Initial Market Rate Data

```sql
-- Insert base skill rates
INSERT INTO market_rate_data (skill_name, skill_category, base_hourly_rate, regional_rates, demand_factor, data_source) VALUES
('React', 'frontend', 70.00, '{"North America": 91.00, "Europe": 77.00, "Asia Pacific": 63.00}'::jsonb, 1.10, 'market_survey_2025'),
('Node.js', 'backend', 80.00, '{"North America": 104.00, "Europe": 88.00, "Asia Pacific": 72.00}'::jsonb, 1.15, 'market_survey_2025'),
('Python', 'backend', 80.00, '{"North America": 104.00, "Europe": 88.00, "Asia Pacific": 72.00}'::jsonb, 1.12, 'market_survey_2025'),
('PostgreSQL', 'database', 75.00, '{"North America": 97.50, "Europe": 82.50, "Asia Pacific": 67.50}'::jsonb, 1.05, 'market_survey_2025'),
('TypeScript', 'frontend', 75.00, '{"North America": 97.50, "Europe": 82.50, "Asia Pacific": 67.50}'::jsonb, 1.08, 'market_survey_2025'),
('AWS', 'devops', 90.00, '{"North America": 117.00, "Europe": 99.00, "Asia Pacific": 81.00}'::jsonb, 1.20, 'market_survey_2025'),
('Docker', 'devops', 85.00, '{"North America": 110.50, "Europe": 93.50, "Asia Pacific": 76.50}'::jsonb, 1.10, 'market_survey_2025'),
('TensorFlow', 'ai_ml', 120.00, '{"North America": 156.00, "Europe": 132.00, "Asia Pacific": 108.00}'::jsonb, 1.30, 'market_survey_2025'),
('Solidity', 'blockchain', 110.00, '{"North America": 143.00, "Europe": 121.00, "Asia Pacific": 99.00}'::jsonb, 1.25, 'market_survey_2025'),
('React Native', 'mobile', 85.00, '{"North America": 110.50, "Europe": 93.50, "Asia Pacific": 76.50}'::jsonb, 1.15, 'market_survey_2025');

-- Add more skills as needed
```

### Step 1.6: Seed Historical Training Data

```sql
-- You need at least 100 completed projects for good model accuracy
-- Example: Import from existing project data

INSERT INTO historical_project_budgets (
  description,
  required_skills,
  estimated_hours,
  actual_hours,
  final_budget,
  complexity_level,
  project_type,
  region,
  tech_stack,
  completion_date
)
SELECT 
  p.description,
  ARRAY(SELECT skill_name FROM project_skills ps WHERE ps.project_id = p.id),
  p.estimated_hours,
  p.actual_hours,
  p.final_budget,
  p.complexity_level,
  p.project_type,
  COALESCE(p.region, 'Global'),
  p.tech_stack,
  p.completed_at
FROM projects p
WHERE p.status = 'completed'
  AND p.final_budget IS NOT NULL
  AND p.completed_at IS NOT NULL;

-- Verify data
SELECT COUNT(*) FROM historical_project_budgets;
-- Should have at least 100 rows
```

---

## Part 2: Python ML Service Deployment

### Step 2.1: Prepare Environment

```bash
cd ml_service/budget_estimation

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2.2: Train Initial Model

```python
# train_model.py
from budget_estimation import ModelTrainer, BudgetEstimator, ProjectFeatureExtractor
import pandas as pd
import psycopg2

# Connect to database
conn = psycopg2.connect(os.getenv('DATABASE_URL'))

# Fetch training data
query = "SELECT * FROM historical_project_budgets ORDER BY completion_date DESC"
df = pd.read_sql(query, conn)

print(f"Loaded {len(df)} training samples")

# Prepare trainer
trainer = ModelTrainer()

# Prepare data
X_train, X_val, X_test, y_train, y_val, y_test = trainer.prepare_training_data(
    df,
    test_size=0.2,
    val_size=0.1
)

print(f"Training set: {len(X_train)}, Validation: {len(X_val)}, Test: {len(X_test)}")

# Train model
estimator, metrics = trainer.train_model(
    X_train, y_train,
    X_val, y_val,
    X_test, y_test
)

# Print metrics
print("\nModel Performance:")
print(f"  MAE: ${metrics['mae']:,.2f}")
print(f"  RMSE: ${metrics['rmse']:,.2f}")
print(f"  MAPE: {metrics['mape']:.2f}%")
print(f"  R² Score: {metrics['r2_score']:.4f}")
print(f"  Accuracy within 10%: {metrics['within_10_percent']*100:.2f}%")
print(f"  CI Coverage: {metrics['ci_coverage_rate']*100:.2f}%")

# Save model
model_path = 'models/budget_model_v1.pkl'
estimator.save_model(model_path)
print(f"\nModel saved to {model_path}")

# Save to database
cursor = conn.cursor()
cursor.execute("""
    INSERT INTO ml_budget_models (
        version,
        model_type,
        training_date,
        performance_metrics,
        training_dataset_size,
        is_active,
        notes
    ) VALUES (%s, %s, NOW(), %s, %s, true, %s)
""", (
    'v1.0.0',
    'ensemble_rf_gb_ridge',
    json.dumps(metrics),
    len(df),
    f'Initial model. Trained on {len(df)} samples.'
))
conn.commit()
print("Model metadata saved to database")

conn.close()
```

```bash
# Run training
python train_model.py
```

### Step 2.3: Configure Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://user:password@host:5432/workdev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

BUDGET_MODEL_PATH=/app/models/budget_model_v1.pkl
MODEL_VERSION=v1.0.0

API_HOST=0.0.0.0
API_PORT=8001
CORS_ORIGINS=http://localhost:3000,https://your-domain.com

MAX_WORKERS=4
CACHE_TTL=300
```

### Step 2.4: Test ML Service Locally

```bash
# Start service
uvicorn api.main:app --reload --host 0.0.0.0 --port 8001

# Test health endpoint
curl http://localhost:8001/health

# Test estimation endpoint
curl -X POST http://localhost:8001/api/v1/budget/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Build a web application with React frontend and Node.js backend. Include user authentication, database integration, and API development.",
    "required_skills": ["React", "Node.js", "PostgreSQL", "AWS"],
    "estimated_hours": 400,
    "complexity_level": "medium",
    "project_type": "web_app",
    "region": "North America"
  }'
```

### Step 2.5: Docker Deployment (Recommended)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Copy trained model
COPY models/budget_model_v1.pkl /app/models/

# Environment
ENV BUDGET_MODEL_PATH=/app/models/budget_model_v1.pkl
ENV API_PORT=8001
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Start service
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
```

```bash
# Build image
docker build -t budget-estimation-api:v1 .

# Run container
docker run -d \
  -p 8001:8001 \
  -e DATABASE_URL=postgresql://... \
  -e BUDGET_MODEL_PATH=/app/models/budget_model_v1.pkl \
  --name budget-api \
  budget-estimation-api:v1

# Check logs
docker logs -f budget-api
```

### Step 2.6: Kubernetes Deployment (Production)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: budget-estimation-api
  labels:
    app: budget-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: budget-api
  template:
    metadata:
      labels:
        app: budget-api
    spec:
      containers:
        - name: api
          image: your-registry/budget-estimation-api:v1
          ports:
            - containerPort: 8001
              protocol: TCP
          env:
            - name: BUDGET_MODEL_PATH
              value: '/app/models/budget_model_v1.pkl'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: budget-api-secrets
                  key: database-url
            - name: API_PORT
              value: '8001'
          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '2Gi'
              cpu: '2000m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: budget-api-service
spec:
  selector:
    app: budget-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8001
  type: LoadBalancer
---
apiVersion: v1
kind: Secret
metadata:
  name: budget-api-secrets
type: Opaque
stringData:
  database-url: postgresql://user:password@host:5432/workdev
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=budget-api
kubectl get svc budget-api-service

# Get service URL
kubectl get svc budget-api-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

---

## Part 3: React Frontend Deployment

### Step 3.1: Configure Environment

```env
# .env.production
REACT_APP_BUDGET_API_URL=https://budget-api.your-domain.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3.2: Fix MUI Grid Compatibility (Known Issue)

The React components currently have MUI v7 Grid compatibility issues. Before production deployment, apply this fix:

```typescript
// Quick fix: Replace Grid with Stack in all components
// Files affected:
// - BudgetEstimationWizard.tsx
// - MarketInsightsPanel.tsx

// Replace all instances of:
import { Grid } from '@mui/material';
// With:
import { Stack, Box } from '@mui/material';

// Then replace Grid containers/items with Stack/Box
```

Or wait for the component updates in the next sprint.

### Step 3.3: Build and Test

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test build locally
npx serve -s build -p 3000

# Open http://localhost:3000 and test the budget estimation wizard
```

### Step 3.4: Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Or via CLI:
vercel env add REACT_APP_BUDGET_API_URL production
vercel env add REACT_APP_SUPABASE_URL production
vercel env add REACT_APP_SUPABASE_ANON_KEY production
```

### Step 3.5: Deploy to AWS S3 + CloudFront (Alternative)

```bash
# Build
npm run build

# Sync to S3
aws s3 sync build/ s3://your-bucket-name/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

# Your app is now live at your CloudFront URL
```

---

## Part 4: Supabase Edge Function Deployment

### Step 4.1: Deploy Retraining Function

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy retrain-budget-model
```

### Step 4.2: Set Environment Secrets

```bash
# Set secrets
supabase secrets set ML_SERVICE_URL=https://budget-api.your-domain.com
supabase secrets set MIN_TRAINING_SAMPLES=100
supabase secrets set PERFORMANCE_IMPROVEMENT_THRESHOLD=0.02
supabase secrets set MODEL_STORAGE_PATH=/app/models
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Verify secrets
supabase secrets list
```

### Step 4.3: Configure Scheduled Execution

```sql
-- Connect to Supabase database
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule weekly retraining (Sundays at 2 AM UTC)
SELECT cron.schedule(
  'retrain-budget-model-weekly',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/retrain-budget-model',
    headers:='{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    timeout_milliseconds:=300000
  ) AS request_id;
  $$
);

-- Verify schedule
SELECT * FROM cron.job WHERE jobname = 'retrain-budget-model-weekly';
```

### Step 4.4: Test Retraining Function

```bash
# Manual trigger
curl -X POST https://your-project.supabase.co/functions/v1/retrain-budget-model \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Check logs
supabase functions logs retrain-budget-model

# Check retraining history
psql -c "SELECT * FROM model_retraining_log ORDER BY retrained_at DESC LIMIT 10;"
```

---

## Part 5: Monitoring and Verification

### Step 5.1: Health Checks

```bash
# ML Service
curl https://budget-api.your-domain.com/health

# Should return:
# {
#   "status": "healthy",
#   "model_loaded": true,
#   "model_version": "v1.0.0",
#   "timestamp": "2025-01-01T12:00:00Z"
# }

# React App
curl https://your-app.vercel.app

# Should return 200 OK
```

### Step 5.2: Test End-to-End

```bash
# Get estimation
curl -X POST https://budget-api.your-domain.com/api/v1/budget/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Build a web application with React frontend and Node.js backend",
    "required_skills": ["React", "Node.js", "PostgreSQL"],
    "estimated_hours": 400,
    "complexity_level": "medium",
    "project_type": "web_app",
    "region": "North America"
  }'

# Should return estimation with budget, confidence interval, breakdown, insights
```

### Step 5.3: Monitor Performance

```sql
-- Check estimation activity
SELECT 
  DATE(created_at) as date,
  COUNT(*) as estimations,
  AVG(response_time_ms) as avg_response_time,
  MAX(response_time_ms) as max_response_time
FROM budget_estimations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Check model accuracy (requires completed projects)
SELECT 
  model_version,
  COUNT(*) as tracked,
  AVG(percentage_error) as avg_error,
  COUNT(*) FILTER (WHERE ABS(percentage_error) <= 10) * 100.0 / COUNT(*) as within_10_pct
FROM estimation_accuracy_tracking
GROUP BY model_version;

-- Check retraining status
SELECT * FROM model_retraining_log ORDER BY retrained_at DESC LIMIT 5;
```

### Step 5.4: Set Up Alerts

Configure alerts for:

- **Critical**:
  - ML service down (health check fails)
  - Model accuracy drops below 70%
  - API response time > 500ms (p95)
  - Estimation failures > 1%

- **Warning**:
  - Model accuracy 70-80%
  - API response time > 300ms (p95)
  - Cache hit rate < 50%
  - Training data < 100 samples

### Step 5.5: Log Aggregation

Set up centralized logging with:

- **CloudWatch** (AWS): Collect logs from ECS/EKS
- **Google Cloud Logging** (GCP): Stream logs from GKE
- **Datadog/New Relic**: Application performance monitoring
- **Supabase Logs**: Monitor Edge Function executions

---

## Part 6: Troubleshooting

### Issue: Model Fails to Load

**Symptoms**: 500 errors on `/api/v1/budget/estimate`

**Solution**:
```bash
# Check model file exists
ls -lh models/budget_model_v1.pkl

# Verify path in env
echo $BUDGET_MODEL_PATH

# Check scikit-learn version matches training
pip show scikit-learn

# Retrain if needed
python train_model.py
```

### Issue: High Response Time

**Symptoms**: API takes >500ms

**Solution**:
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Add database indexes if missing
psql $DATABASE_URL -f supabase/migrations/20251001_budget_estimation.sql

# Scale ML service
kubectl scale deployment budget-estimation-api --replicas=5

# Enable caching in TypeScript service (already enabled)
```

### Issue: Retraining Fails

**Symptoms**: Edge Function returns errors

**Solution**:
```bash
# Check Edge Function logs
supabase functions logs retrain-budget-model --tail

# Verify ML service is accessible
curl https://budget-api.your-domain.com/health

# Check training data
psql -c "SELECT COUNT(*) FROM historical_project_budgets;"

# Manual retrain trigger
curl -X POST https://your-project.supabase.co/functions/v1/retrain-budget-model \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

---

## Deployment Checklist

**Pre-Deployment**:
- [ ] Database migration applied
- [ ] At least 100 historical projects loaded
- [ ] Initial model trained
- [ ] ML service tested locally
- [ ] React app builds without errors
- [ ] Environment variables configured

**Deployment**:
- [ ] ML service deployed (Docker/K8s)
- [ ] React app deployed (Vercel/S3)
- [ ] Edge Function deployed
- [ ] pg_cron scheduled job created
- [ ] Secrets configured

**Post-Deployment**:
- [ ] Health checks passing
- [ ] End-to-end test successful
- [ ] Monitoring dashboards set up
- [ ] Alerts configured
- [ ] Team notified

**Within 1 Week**:
- [ ] Monitor estimation accuracy
- [ ] Collect user feedback
- [ ] Review performance metrics
- [ ] Plan first model retrain

---

## Support and Maintenance

**Daily**:
- Check health endpoints
- Monitor error rates
- Review slow queries

**Weekly**:
- Review estimation accuracy
- Check model performance
- Analyze user feedback

**Monthly**:
- Model retraining review
- Performance optimization
- Feature updates

**Documentation**:
- `docs/BUDGET_ESTIMATION_GUIDE.md`: Complete implementation guide
- `docs/BUDGET_ESTIMATION_SUMMARY.md`: Project summary and statistics
- This file: Deployment configuration

---

**Last Updated**: 2025-01-01  
**Version**: 1.0.0  
**Status**: Production Ready (with minor MUI Grid fix needed)
