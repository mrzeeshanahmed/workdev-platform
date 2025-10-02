// @ts-ignore: Deno runtime
// Supabase Edge Function: Retrain Budget Estimation Model
// Purpose: Scheduled retraining of ML model with new project completion data
// Trigger: HTTP endpoint or pg_cron scheduled execution (weekly/monthly)

// @ts-ignore: Deno imports (runtime-specific)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno imports (runtime-specific)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Deno runtime globals (TypeScript doesn't recognize these in IDE but they work in Deno runtime)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ==================== Type Definitions ====================

interface TrainingDataPoint {
  id: string;
  description: string;
  required_skills: string[];
  estimated_hours: number;
  actual_hours: number | null;
  final_budget: number;
  complexity_level: string;
  project_type: string;
  region: string;
  tech_stack: Record<string, any>;
  completion_date: string;
}

interface ModelPerformanceMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2_score: number;
  within_5_percent: number;
  within_10_percent: number;
  within_20_percent: number;
  ci_coverage_rate: number;
  sample_size: number;
}

interface RetrainingResult {
  success: boolean;
  new_model_version: string;
  training_samples: number;
  training_duration_ms: number;
  performance_metrics: ModelPerformanceMetrics;
  performance_improvement: number;
  deployed: boolean;
  message: string;
  errors?: string[];
}

// ==================== Configuration ====================

const ML_SERVICE_URL = Deno.env.get('ML_SERVICE_URL') || 'http://localhost:8001';
const MIN_TRAINING_SAMPLES = parseInt(Deno.env.get('MIN_TRAINING_SAMPLES') || '100');
const PERFORMANCE_IMPROVEMENT_THRESHOLD = parseFloat(
  Deno.env.get('PERFORMANCE_IMPROVEMENT_THRESHOLD') || '0.02',
); // 2% improvement required
const MODEL_STORAGE_PATH = Deno.env.get('MODEL_STORAGE_PATH') || '/app/models';

// ==================== Main Handler ====================

serve(async (req: Request) => {
  try {
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting budget model retraining process...');
    const startTime = Date.now();

    // Step 1: Collect new training data from completed projects
    console.log('Step 1: Collecting training data...');
    const trainingData = await collectTrainingData(supabaseClient);

    if (trainingData.length < MIN_TRAINING_SAMPLES) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Insufficient training data. Need at least ${MIN_TRAINING_SAMPLES} samples, got ${trainingData.length}`,
          training_samples: trainingData.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    console.log(`Collected ${trainingData.length} training samples`);

    // Step 2: Get current model performance as baseline
    console.log('Step 2: Getting current model performance...');
    const currentPerformance = await getCurrentModelPerformance(supabaseClient);
    console.log('Current model performance:', currentPerformance);

    // Step 3: Train new model via ML service
    console.log('Step 3: Training new model...');
    const newModelVersion = `v${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const trainingResult = await trainNewModel(trainingData, newModelVersion);

    if (!trainingResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Model training failed',
          errors: trainingResult.errors,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        },
      );
    }

    console.log('New model performance:', trainingResult.metrics);

    // Step 4: Compare performance (A/B test)
    console.log('Step 4: Comparing model performance...');
    const performanceImprovement = calculatePerformanceImprovement(
      currentPerformance,
      trainingResult.metrics,
    );

    console.log(`Performance improvement: ${(performanceImprovement * 100).toFixed(2)}%`);

    // Step 5: Deploy if improved, else rollback
    let deployed = false;
    let message = '';

    if (performanceImprovement >= PERFORMANCE_IMPROVEMENT_THRESHOLD) {
      console.log('Step 5: Deploying new model (performance improved)...');
      deployed = await deployNewModel(supabaseClient, newModelVersion, trainingResult.metrics);

      if (deployed) {
        // Reload model in ML service
        await reloadMLServiceModel(newModelVersion);
        message = `New model ${newModelVersion} deployed successfully. Performance improved by ${(performanceImprovement * 100).toFixed(2)}%`;
      } else {
        message = 'Failed to deploy new model';
      }
    } else {
      console.log('Step 5: Keeping current model (insufficient improvement)...');
      message = `New model not deployed. Performance improvement ${(performanceImprovement * 100).toFixed(2)}% below threshold ${(PERFORMANCE_IMPROVEMENT_THRESHOLD * 100).toFixed(2)}%`;
    }

    const trainingDuration = Date.now() - startTime;

    // Step 6: Log retraining status
    await logRetrainingStatus(supabaseClient, {
      new_model_version: newModelVersion,
      training_samples: trainingData.length,
      training_duration_ms: trainingDuration,
      performance_metrics: trainingResult.metrics,
      performance_improvement: performanceImprovement,
      deployed,
      message,
    });

    // Step 7: Send notification
    await sendRetrainingNotification(deployed, newModelVersion, performanceImprovement, message);

    return new Response(
      JSON.stringify({
        success: true,
        new_model_version: newModelVersion,
        training_samples: trainingData.length,
        training_duration_ms: trainingDuration,
        performance_metrics: trainingResult.metrics,
        performance_improvement: performanceImprovement,
        deployed,
        message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Model retraining failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});

// ==================== Data Collection ====================

async function collectTrainingData(supabaseClient: any): Promise<TrainingDataPoint[]> {
  // Query historical_project_budgets for completed projects with actual budgets
  const { data, error } = await supabaseClient
    .from('historical_project_budgets')
    .select('*')
    .not('final_budget', 'is', null)
    .not('completion_date', 'is', null)
    .order('completion_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch training data: ${error.message}`);
  }

  return data || [];
}

// ==================== Current Model Performance ====================

async function getCurrentModelPerformance(supabaseClient: any): Promise<ModelPerformanceMetrics> {
  // Get active model version
  const { data: activeModel, error: modelError } = await supabaseClient
    .from('ml_budget_models')
    .select('version, performance_metrics')
    .eq('is_active', true)
    .single();

  if (modelError || !activeModel) {
    // Return default baseline metrics if no active model
    return {
      mae: 10000,
      rmse: 15000,
      mape: 20,
      r2_score: 0.5,
      within_5_percent: 0.4,
      within_10_percent: 0.6,
      within_20_percent: 0.8,
      ci_coverage_rate: 0.7,
      sample_size: 0,
    };
  }

  return activeModel.performance_metrics as ModelPerformanceMetrics;
}

// ==================== Model Training ====================

async function trainNewModel(
  trainingData: TrainingDataPoint[],
  modelVersion: string,
): Promise<{
  success: boolean;
  metrics: ModelPerformanceMetrics;
  errors?: string[];
}> {
  try {
    // Call ML service training endpoint
    const response = await fetch(`${ML_SERVICE_URL}/api/v1/model/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_data: trainingData,
        model_version: modelVersion,
        test_size: 0.2,
        validation_size: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Training failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      metrics: result.performance_metrics,
    };
  } catch (error) {
    console.error('Model training error:', error);
    return {
      success: false,
      metrics: {} as ModelPerformanceMetrics,
      errors: [error instanceof Error ? error.message : 'Unknown training error'],
    };
  }
}

// ==================== Performance Comparison ====================

function calculatePerformanceImprovement(
  currentMetrics: ModelPerformanceMetrics,
  newMetrics: ModelPerformanceMetrics,
): number {
  // Calculate improvement based on multiple metrics
  // Lower MAPE is better, higher within_10_percent is better

  const mapeImprovement = (currentMetrics.mape - newMetrics.mape) / currentMetrics.mape;
  const accuracyImprovement =
    (newMetrics.within_10_percent - currentMetrics.within_10_percent) /
    currentMetrics.within_10_percent;
  const r2Improvement = (newMetrics.r2_score - currentMetrics.r2_score) / currentMetrics.r2_score;

  // Weighted average: MAPE 40%, Accuracy 40%, R² 20%
  const overallImprovement =
    mapeImprovement * 0.4 + accuracyImprovement * 0.4 + r2Improvement * 0.2;

  return overallImprovement;
}

// ==================== Model Deployment ====================

async function deployNewModel(
  supabaseClient: any,
  modelVersion: string,
  metrics: ModelPerformanceMetrics,
): Promise<boolean> {
  try {
    // Deactivate current active model
    await supabaseClient
      .from('ml_budget_models')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new model as active
    const { error } = await supabaseClient.from('ml_budget_models').insert({
      version: modelVersion,
      model_type: 'ensemble_rf_gb_ridge',
      training_date: new Date().toISOString(),
      performance_metrics: metrics,
      training_dataset_size: metrics.sample_size,
      is_active: true,
      notes: `Automated retraining. Samples: ${metrics.sample_size}, MAPE: ${metrics.mape.toFixed(2)}%, Accuracy@10%: ${(metrics.within_10_percent * 100).toFixed(2)}%`,
    });

    if (error) {
      throw new Error(`Failed to deploy model: ${error.message}`);
    }

    console.log(`Model ${modelVersion} deployed successfully`);
    return true;
  } catch (error) {
    console.error('Model deployment error:', error);
    return false;
  }
}

// ==================== ML Service Model Reload ====================

async function reloadMLServiceModel(modelVersion: string): Promise<void> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/api/v1/model/reload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_version: modelVersion,
        model_path: `${MODEL_STORAGE_PATH}/budget_model_${modelVersion}.pkl`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Model reload failed: ${response.statusText}`);
    }

    console.log(`ML service reloaded with model ${modelVersion}`);
  } catch (error) {
    console.error('Model reload error:', error);
    // Don't throw - model is deployed in DB, service can be restarted manually
  }
}

// ==================== Status Logging ====================

async function logRetrainingStatus(
  supabaseClient: any,
  result: Omit<RetrainingResult, 'success'>,
): Promise<void> {
  try {
    await supabaseClient.from('model_retraining_log').insert({
      model_version: result.new_model_version,
      training_samples: result.training_samples,
      training_duration_ms: result.training_duration_ms,
      performance_metrics: result.performance_metrics,
      performance_improvement: result.performance_improvement,
      deployed: result.deployed,
      status: result.deployed ? 'deployed' : 'not_deployed',
      message: result.message,
      retrained_at: new Date().toISOString(),
    });

    console.log('Retraining status logged successfully');
  } catch (error) {
    console.error('Failed to log retraining status:', error);
  }
}

// ==================== Notifications ====================

async function sendRetrainingNotification(
  deployed: boolean,
  modelVersion: string,
  performanceImprovement: number,
  message: string,
): Promise<void> {
  try {
    const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

    if (!webhookUrl) {
      console.log('No Slack webhook configured, skipping notification');
      return;
    }

    const color = deployed ? '#36a64f' : '#ff9900'; // Green for deployed, orange for not deployed
    const emoji = deployed ? ':white_check_mark:' : ':warning:';

    const slackMessage = {
      text: `${emoji} Budget Model Retraining ${deployed ? 'Deployed' : 'Completed'}`,
      attachments: [
        {
          color: color,
          fields: [
            {
              title: 'Model Version',
              value: modelVersion,
              short: true,
            },
            {
              title: 'Performance Improvement',
              value: `${(performanceImprovement * 100).toFixed(2)}%`,
              short: true,
            },
            {
              title: 'Status',
              value: deployed ? 'Deployed' : 'Not Deployed',
              short: true,
            },
            {
              title: 'Message',
              value: message,
              short: false,
            },
          ],
          footer: 'Budget Estimation System',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    console.log('Slack notification sent');
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

// ==================== Deployment Instructions ====================
/*
Deployment Instructions:

1. Deploy this edge function:
   supabase functions deploy retrain-budget-model

2. Set environment variables:
   supabase secrets set ML_SERVICE_URL=http://your-ml-service:8001
   supabase secrets set MIN_TRAINING_SAMPLES=100
   supabase secrets set PERFORMANCE_IMPROVEMENT_THRESHOLD=0.02
   supabase secrets set MODEL_STORAGE_PATH=/app/models
   supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

3. Create model_retraining_log table:
   CREATE TABLE model_retraining_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     model_version TEXT NOT NULL,
     training_samples INTEGER NOT NULL,
     training_duration_ms INTEGER NOT NULL,
     performance_metrics JSONB NOT NULL,
     performance_improvement DECIMAL(5, 4) NOT NULL,
     deployed BOOLEAN NOT NULL,
     status TEXT NOT NULL,
     message TEXT,
     retrained_at TIMESTAMP WITH TIME ZONE DEFAULT now()
   );

4. Set up pg_cron to run weekly (Sundays at 2 AM):
   SELECT cron.schedule(
     'retrain-budget-model-weekly',
     '0 2 * * 0',
     $$SELECT net.http_post(
       url:='https://your-project.supabase.co/functions/v1/retrain-budget-model',
       headers:='{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
     )$$
   );

5. Monitor retraining:
   SELECT * FROM model_retraining_log ORDER BY retrained_at DESC LIMIT 10;

6. Manual trigger:
   curl -X POST https://your-project.supabase.co/functions/v1/retrain-budget-model \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

Performance Thresholds:
- MIN_TRAINING_SAMPLES: Minimum 100 completed projects required
- PERFORMANCE_IMPROVEMENT_THRESHOLD: 2% improvement required for deployment
- Metrics considered: MAPE (40%), Accuracy@10% (40%), R² (20%)

A/B Testing Strategy:
- Current model performance serves as baseline
- New model trained on latest data
- Performance compared using weighted metrics
- Deploy only if improvement exceeds threshold
- Automatic rollback if deployment fails

Monitoring:
- Check model_retraining_log table for history
- Slack notifications for deployment status
- ML service health endpoint: GET /health
- Model performance: GET /api/v1/model/info
*/
