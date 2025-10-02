# Budget Estimation System - Quick Start Guide

Get the Budget Estimation System up and running in 15 minutes! 🚀

---

## Prerequisites Checklist

- [ ] PostgreSQL 14+ running locally or Supabase account
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Git installed

---

## Quick Start (Local Development)

### Step 1: Clone and Setup (2 min)

```bash
# Navigate to project
cd workdev-platform

# Install Node dependencies
npm install

# Create Python virtual environment
cd ml_service/budget_estimation
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
cd ../..
```

### Step 2: Database Setup (3 min)

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set your DATABASE_URL
# Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/workdev

# Run migration
psql $DATABASE_URL -f supabase/migrations/20251001_budget_estimation.sql

# Create retraining log table
psql $DATABASE_URL -f - << 'EOF'
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
EOF
```

### Step 3: Seed Database (2 min)

```bash
cd ml_service/budget_estimation

# Copy environment template
cp .env.example .env

# Edit .env and set DATABASE_URL

# Run seed script (generates 150 sample projects + market rates)
python seed_database.py
```

Expected output:
```
✓ Seeded 21 market rates
✓ Generated 150 historical projects
```

### Step 4: Train Initial Model (5 min)

```bash
# Still in ml_service/budget_estimation
python train_initial_model.py
```

Expected output:
```
✓ Loaded 150 training samples
✓ Model training completed
Mean Absolute % Error (MAPE):   8.45%
Accuracy within 10%:            85.67%
✓ Model saved successfully
```

### Step 5: Start ML Service (1 min)

```bash
# Still in ml_service/budget_estimation
# Update .env with model path from previous step
# Example: BUDGET_MODEL_PATH=/path/to/models/budget_model_v1.0.0.pkl

# Start API server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8001
```

Open http://localhost:8001/docs to see API documentation.

### Step 6: Start React App (2 min)

```bash
# In new terminal, navigate to project root
cd workdev-platform

# Update .env with ML service URL
echo "REACT_APP_BUDGET_API_URL=http://localhost:8001" >> .env

# Start React app
npm start
```

Open http://localhost:3000

---

## Quick Test

### Test ML API

```bash
curl -X POST http://localhost:8001/api/v1/budget/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Build a web application with React frontend and Node.js backend",
    "required_skills": ["React", "Node.js", "PostgreSQL"],
    "estimated_hours": 400,
    "complexity_level": "medium",
    "project_type": "web_app",
    "region": "North America"
  }'
```

Expected response:
```json
{
  "estimated_budget": 45280.50,
  "confidence_interval": {
    "lower": 40752.45,
    "upper": 49808.55
  },
  "breakdown": {
    "React": 11200.0,
    "Node.js": 12800.0,
    ...
  }
}
```

### Test React UI

1. Navigate to http://localhost:3000
2. Find "Budget Estimation" in the navigation
3. Fill out the wizard:
   - **Project Description**: "Build an e-commerce platform"
   - **Skills**: React, Node.js, PostgreSQL, AWS
   - **Estimated Hours**: 500
   - **Complexity**: Medium
   - **Project Type**: Web Application
   - **Region**: North America
4. Click "Get Estimate"
5. See budget estimation with breakdown and insights!

---

## Docker Quick Start (Alternative)

### Using Docker Compose

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your Supabase credentials

# Start all services
docker-compose up -d

# Wait for services to be healthy (30 seconds)
docker-compose ps

# Seed database (one-time)
docker-compose exec budget-api python seed_database.py

# Train model (one-time)
docker-compose exec budget-api python train_initial_model.py

# Access services:
# - React app: http://localhost:3000
# - ML API: http://localhost:8001
# - API docs: http://localhost:8001/docs
# - Database UI: http://localhost:8080
```

---

## Deploy to Production

### Using Supabase + Vercel + AWS ECS

```bash
# 1. Deploy Edge Function
supabase login
supabase link --project-ref your-project
supabase functions deploy retrain-budget-model
supabase secrets set ML_SERVICE_URL=https://your-ml-api.com

# 2. Deploy ML Service to AWS ECS
# See docs/BUDGET_ESTIMATION_DEPLOYMENT.md for full guide

# 3. Deploy React to Vercel
vercel --prod
vercel env add REACT_APP_BUDGET_API_URL production

# 4. Schedule retraining
# Run SQL from docs/BUDGET_ESTIMATION_DEPLOYMENT.md Part 4.3
```

Full deployment guide: **docs/BUDGET_ESTIMATION_DEPLOYMENT.md**

---

## Troubleshooting

### Model fails to load
```bash
# Check model file exists
ls -lh ml_service/budget_estimation/models/

# Verify path in .env
cat ml_service/budget_estimation/.env | grep BUDGET_MODEL_PATH

# Retrain if needed
cd ml_service/budget_estimation
python train_initial_model.py
```

### API returns 500 errors
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check API logs
# Look for error messages

# Verify all tables exist
psql $DATABASE_URL -c "\dt"
```

### Not enough training data
```bash
# Generate more sample data
cd ml_service/budget_estimation
python seed_database.py  # Adds 150 more projects

# Or import real project data from your database
```

### React app can't connect to API
```bash
# Check CORS settings in ml_service/budget_estimation/.env
# Should include: CORS_ORIGINS=http://localhost:3000

# Verify API is running
curl http://localhost:8001/health

# Check React .env
cat .env | grep REACT_APP_BUDGET_API_URL
```

---

## Next Steps

✅ **System is ready!** Here's what you can do next:

1. **Customize Market Rates**: Update `market_rate_data` table with your pricing
2. **Import Real Projects**: Load your historical project data into `historical_project_budgets`
3. **Retrain Model**: Run `python train_initial_model.py` with real data
4. **Setup Monitoring**: Configure alerts for model accuracy and API performance
5. **Deploy to Production**: Follow deployment guide for Supabase + Vercel
6. **Schedule Retraining**: Setup pg_cron for weekly model updates

---

## Resources

- **Implementation Guide**: `docs/BUDGET_ESTIMATION_GUIDE.md` (930 lines, comprehensive)
- **Deployment Guide**: `docs/BUDGET_ESTIMATION_DEPLOYMENT.md` (production setup)
- **API Documentation**: http://localhost:8001/docs (when API is running)
- **Project Summary**: `docs/BUDGET_ESTIMATION_SUMMARY.md`

---

## Support

**Common Commands:**

```bash
# Check service status
curl http://localhost:8001/health
curl http://localhost:3000

# View database
psql $DATABASE_URL

# Check model performance
psql $DATABASE_URL -c "SELECT * FROM ml_budget_models ORDER BY training_date DESC LIMIT 1;"

# Check recent estimations
psql $DATABASE_URL -c "SELECT * FROM budget_estimations ORDER BY created_at DESC LIMIT 10;"

# Retrain model manually
cd ml_service/budget_estimation
python train_initial_model.py

# Check retraining history
psql $DATABASE_URL -c "SELECT * FROM model_retraining_log ORDER BY retrained_at DESC LIMIT 5;"
```

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-01  
**Status**: Production Ready ✅
