#!/usr/bin/env python3
"""
Initial Model Training Script
Trains the first version of the Budget Estimation ML model
"""

import os
import sys
import json
from datetime import datetime
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from budget_estimation import ModelTrainer, BudgetEstimator

# Load environment variables
load_dotenv()

def main():
    print("=" * 80)
    print("Budget Estimation Model - Initial Training")
    print("=" * 80)
    print()

    # Database connection
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(db_url)
        print("✓ Connected successfully")
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        sys.exit(1)

    print()

    # Fetch training data
    print("Fetching training data from historical_project_budgets...")
    query = """
        SELECT 
            id,
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
        FROM historical_project_budgets
        WHERE final_budget IS NOT NULL
          AND actual_hours IS NOT NULL
          AND completion_date IS NOT NULL
        ORDER BY completion_date DESC
    """
    
    try:
        df = pd.read_sql(query, conn)
        print(f"✓ Loaded {len(df)} training samples")
    except Exception as e:
        print(f"✗ Failed to load data: {e}")
        conn.close()
        sys.exit(1)

    if len(df) < 100:
        print(f"\n⚠ WARNING: Only {len(df)} samples available. Minimum recommended: 100")
        print("Model may have reduced accuracy. Consider importing more historical data.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Training cancelled.")
            conn.close()
            sys.exit(0)

    print()

    # Initialize trainer
    print("Initializing model trainer...")
    trainer = ModelTrainer()
    print("✓ Trainer initialized")
    print()

    # Prepare data
    print("Preparing training/validation/test splits...")
    X_train, X_val, X_test, y_train, y_val, y_test = trainer.prepare_training_data(
        df,
        test_size=0.2,
        val_size=0.1
    )
    
    print(f"✓ Training set: {len(X_train)} samples")
    print(f"✓ Validation set: {len(X_val)} samples")
    print(f"✓ Test set: {len(X_test)} samples")
    print()

    # Train model
    print("Training ensemble model (Random Forest + Gradient Boosting + Ridge)...")
    print("This may take several minutes...")
    print()
    
    try:
        estimator, metrics = trainer.train_model(
            X_train, y_train,
            X_val, y_val,
            X_test, y_test
        )
        print("✓ Model training completed")
    except Exception as e:
        print(f"✗ Training failed: {e}")
        conn.close()
        sys.exit(1)

    print()
    print("=" * 80)
    print("Model Performance Metrics")
    print("=" * 80)
    print(f"Mean Absolute Error (MAE):     ${metrics['mae']:>15,.2f}")
    print(f"Root Mean Squared Error (RMSE): ${metrics['rmse']:>15,.2f}")
    print(f"Mean Absolute % Error (MAPE):   {metrics['mape']:>16.2f}%")
    print(f"R² Score:                       {metrics['r2_score']:>16.4f}")
    print(f"Accuracy within 10%:            {metrics['within_10_percent']*100:>16.2f}%")
    print(f"Accuracy within 20%:            {metrics['within_20_percent']*100:>16.2f}%")
    print(f"Confidence Interval Coverage:   {metrics['ci_coverage_rate']*100:>16.2f}%")
    print("=" * 80)
    print()

    # Save model
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    model_version = 'v1.0.0'
    model_filename = f'budget_model_{model_version}.pkl'
    model_path = os.path.join(model_dir, model_filename)
    
    print(f"Saving model to {model_path}...")
    try:
        estimator.save_model(model_path)
        print("✓ Model saved successfully")
    except Exception as e:
        print(f"✗ Failed to save model: {e}")
        conn.close()
        sys.exit(1)

    print()

    # Save to database
    print("Saving model metadata to database...")
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO ml_budget_models (
                version,
                model_type,
                training_date,
                performance_metrics,
                training_dataset_size,
                is_active,
                notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            model_version,
            'ensemble_rf_gb_ridge',
            datetime.now(),
            json.dumps(metrics),
            len(df),
            True,
            f'Initial model. Trained on {len(df)} historical projects.'
        ))
        conn.commit()
        print("✓ Metadata saved to ml_budget_models table")
    except Exception as e:
        print(f"✗ Failed to save metadata: {e}")
        conn.rollback()
    finally:
        cursor.close()

    conn.close()

    print()
    print("=" * 80)
    print("TRAINING COMPLETED SUCCESSFULLY")
    print("=" * 80)
    print()
    print("Next steps:")
    print(f"1. Update ML_SERVICE environment variable:")
    print(f"   BUDGET_MODEL_PATH={model_path}")
    print(f"2. Restart the ML service to load the new model")
    print(f"3. Test the model with: curl http://localhost:8001/health")
    print(f"4. Make your first estimation via the API")
    print()

if __name__ == '__main__':
    main()
