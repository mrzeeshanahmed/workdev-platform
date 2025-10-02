"""
Budget Estimation Model Training Pipeline
Trains and evaluates budget estimation models with cross-validation
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, List
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from datetime import datetime
import json

from .budget_estimator import BudgetEstimator


class ModelTrainer:
    """Train and evaluate budget estimation models"""
    
    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.estimator = None
        self.evaluation_results = {}
        
    def prepare_training_data(self, raw_data: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare and clean training data
        
        Args:
            raw_data: Raw historical project data
            
        Returns:
            Cleaned DataFrame ready for training
        """
        print("Preparing training data...")
        
        df = raw_data.copy()
        
        # Remove rows with missing critical fields
        df = df.dropna(subset=['final_budget', 'description'])
        
        # Remove outliers (budget > 3 std devs from mean)
        mean_budget = df['final_budget'].mean()
        std_budget = df['final_budget'].std()
        df = df[df['final_budget'] <= mean_budget + (3 * std_budget)]
        df = df[df['final_budget'] >= mean_budget - (3 * std_budget)]
        
        # Ensure positive budgets
        df = df[df['final_budget'] > 0]
        
        # Fill missing values
        df['estimated_hours'] = df['estimated_hours'].fillna(160)
        df['estimated_duration_weeks'] = df['estimated_duration_weeks'].fillna(4)
        df['complexity_level'] = df['complexity_level'].fillna('medium')
        df['region'] = df['region'].fillna('Global')
        df['project_type'] = df['project_type'].fillna('web_app')
        
        # Ensure required_skills is a list
        if 'required_skills' in df.columns:
            df['required_skills'] = df['required_skills'].apply(
                lambda x: x if isinstance(x, list) else (json.loads(x) if isinstance(x, str) else [])
            )
        
        print(f"Training data prepared: {len(df)} samples")
        
        return df
    
    def train_model(
        self, 
        training_data: pd.DataFrame,
        test_size: float = 0.2,
        validation_size: float = 0.1,
        random_state: int = 42
    ) -> Dict[str, any]:
        """
        Train budget estimation model with train/val/test split
        
        Args:
            training_data: Prepared training data
            test_size: Fraction of data for testing
            validation_size: Fraction of data for validation
            random_state: Random seed
            
        Returns:
            Training results and metrics
        """
        print(f"\nTraining Budget Estimation Model v{self.model_version}")
        print("=" * 60)
        
        # Prepare data
        cleaned_data = self.prepare_training_data(training_data)
        
        # Split data
        train_val, test = train_test_split(
            cleaned_data, 
            test_size=test_size, 
            random_state=random_state
        )
        
        train, val = train_test_split(
            train_val,
            test_size=validation_size / (1 - test_size),
            random_state=random_state
        )
        
        print(f"\nData split:")
        print(f"  Training: {len(train)} samples")
        print(f"  Validation: {len(val)} samples")
        print(f"  Test: {len(test)} samples")
        
        # Initialize and train model
        self.estimator = BudgetEstimator(model_version=self.model_version)
        training_metrics = self.estimator.train(train)
        
        # Evaluate on validation set
        print("\nEvaluating on validation set...")
        val_metrics = self._evaluate_model(val, "Validation")
        
        # Evaluate on test set
        print("\nEvaluating on test set...")
        test_metrics = self._evaluate_model(test, "Test")
        
        # Perform cross-validation
        print("\nPerforming cross-validation...")
        cv_metrics = self._cross_validate(cleaned_data)
        
        # Compile all results
        results = {
            'model_version': self.model_version,
            'training_date': datetime.now().isoformat(),
            'data_splits': {
                'train_samples': len(train),
                'val_samples': len(val),
                'test_samples': len(test)
            },
            'training_metrics': training_metrics,
            'validation_metrics': val_metrics,
            'test_metrics': test_metrics,
            'cross_validation_metrics': cv_metrics
        }
        
        self.evaluation_results = results
        
        # Print summary
        self._print_training_summary(results)
        
        return results
    
    def _evaluate_model(self, data: pd.DataFrame, set_name: str) -> Dict[str, float]:
        """Evaluate model on a dataset"""
        predictions = []
        actuals = []
        errors = []
        within_ci = []
        
        for _, row in data.iterrows():
            try:
                # Create project details dict
                project_details = {
                    'description': row['description'],
                    'required_skills': row['required_skills'],
                    'estimated_hours': row.get('estimated_hours', 160),
                    'complexity_level': row.get('complexity_level', 'medium'),
                    'project_type': row.get('project_type', 'web_app'),
                    'region': row.get('region', 'Global'),
                    'estimated_duration_weeks': row.get('estimated_duration_weeks', 4)
                }
                
                # Get prediction
                result = self.estimator.estimate_budget(project_details)
                
                predicted = result['estimated_budget']
                actual = row['final_budget']
                
                predictions.append(predicted)
                actuals.append(actual)
                errors.append(abs(predicted - actual))
                
                # Check if within confidence interval
                ci_lower = result['confidence_interval']['lower_bound']
                ci_upper = result['confidence_interval']['upper_bound']
                within_ci.append(ci_lower <= actual <= ci_upper)
                
            except Exception as e:
                print(f"Error evaluating row: {e}")
                continue
        
        # Calculate metrics
        predictions = np.array(predictions)
        actuals = np.array(actuals)
        errors = np.array(errors)
        
        mae = np.mean(errors)
        rmse = np.sqrt(np.mean(errors ** 2))
        mape = np.mean(np.abs((actuals - predictions) / actuals)) * 100
        
        # R-squared
        ss_res = np.sum((actuals - predictions) ** 2)
        ss_tot = np.sum((actuals - np.mean(actuals)) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Accuracy within thresholds
        within_5_pct = np.mean(np.abs((actuals - predictions) / actuals) <= 0.05) * 100
        within_10_pct = np.mean(np.abs((actuals - predictions) / actuals) <= 0.10) * 100
        within_20_pct = np.mean(np.abs((actuals - predictions) / actuals) <= 0.20) * 100
        
        # Confidence interval coverage
        ci_coverage = np.mean(within_ci) * 100
        
        return {
            'mae': round(mae, 2),
            'rmse': round(rmse, 2),
            'mape': round(mape, 2),
            'r2': round(r2, 4),
            'within_5_percent': round(within_5_pct, 2),
            'within_10_percent': round(within_10_pct, 2),
            'within_20_percent': round(within_20_pct, 2),
            'ci_coverage_80': round(ci_coverage, 2),
            'sample_size': len(predictions)
        }
    
    def _cross_validate(self, data: pd.DataFrame, n_folds: int = 5) -> Dict[str, float]:
        """Perform k-fold cross-validation"""
        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
        
        fold_metrics = []
        
        for fold_idx, (train_idx, val_idx) in enumerate(kf.split(data), 1):
            print(f"  Fold {fold_idx}/{n_folds}...", end=" ")
            
            train_fold = data.iloc[train_idx]
            val_fold = data.iloc[val_idx]
            
            # Train temporary model
            temp_estimator = BudgetEstimator(model_version=f"{self.model_version}-cv{fold_idx}")
            temp_estimator.train(train_fold)
            
            # Evaluate
            fold_predictions = []
            fold_actuals = []
            
            for _, row in val_fold.iterrows():
                try:
                    project_details = {
                        'description': row['description'],
                        'required_skills': row['required_skills'],
                        'estimated_hours': row.get('estimated_hours', 160),
                        'complexity_level': row.get('complexity_level', 'medium'),
                        'project_type': row.get('project_type', 'web_app'),
                        'region': row.get('region', 'Global')
                    }
                    
                    result = temp_estimator.estimate_budget(project_details)
                    fold_predictions.append(result['estimated_budget'])
                    fold_actuals.append(row['final_budget'])
                except:
                    continue
            
            # Calculate fold metrics
            fold_predictions = np.array(fold_predictions)
            fold_actuals = np.array(fold_actuals)
            
            fold_mae = np.mean(np.abs(fold_predictions - fold_actuals))
            fold_r2 = 1 - (np.sum((fold_actuals - fold_predictions) ** 2) / 
                          np.sum((fold_actuals - np.mean(fold_actuals)) ** 2))
            
            fold_metrics.append({
                'mae': fold_mae,
                'r2': fold_r2
            })
            
            print(f"MAE: {fold_mae:.2f}, R²: {fold_r2:.4f}")
        
        # Aggregate metrics
        avg_mae = np.mean([m['mae'] for m in fold_metrics])
        avg_r2 = np.mean([m['r2'] for m in fold_metrics])
        std_mae = np.std([m['mae'] for m in fold_metrics])
        std_r2 = np.std([m['r2'] for m in fold_metrics])
        
        return {
            'cv_mae_mean': round(avg_mae, 2),
            'cv_mae_std': round(std_mae, 2),
            'cv_r2_mean': round(avg_r2, 4),
            'cv_r2_std': round(std_r2, 4),
            'n_folds': n_folds
        }
    
    def _print_training_summary(self, results: Dict[str, any]):
        """Print training summary"""
        print("\n" + "=" * 60)
        print("TRAINING SUMMARY")
        print("=" * 60)
        
        print(f"\nModel Version: {results['model_version']}")
        print(f"Training Date: {results['training_date']}")
        
        print("\nData Split:")
        for split, count in results['data_splits'].items():
            print(f"  {split}: {count}")
        
        print("\nTest Set Performance:")
        test_metrics = results['test_metrics']
        print(f"  MAE: ${test_metrics['mae']:,.2f}")
        print(f"  RMSE: ${test_metrics['rmse']:,.2f}")
        print(f"  MAPE: {test_metrics['mape']:.2f}%")
        print(f"  R²: {test_metrics['r2']:.4f}")
        print(f"  Within 10% Accuracy: {test_metrics['within_10_percent']:.2f}%")
        print(f"  80% CI Coverage: {test_metrics['ci_coverage_80']:.2f}%")
        
        print("\nCross-Validation:")
        cv_metrics = results['cross_validation_metrics']
        print(f"  MAE: ${cv_metrics['cv_mae_mean']:,.2f} ± ${cv_metrics['cv_mae_std']:,.2f}")
        print(f"  R²: {cv_metrics['cv_r2_mean']:.4f} ± {cv_metrics['cv_r2_std']:.4f}")
        
        # Performance assessment
        print("\nPerformance Assessment:")
        if test_metrics['within_10_percent'] >= 80:
            print("  ✓ PASSED: Achieves 80%+ accuracy within 10% threshold")
        else:
            print(f"  ✗ NEEDS IMPROVEMENT: Only {test_metrics['within_10_percent']:.1f}% within 10%")
        
        if test_metrics['mape'] <= 15:
            print("  ✓ PASSED: MAPE below 15%")
        else:
            print(f"  ✗ NEEDS IMPROVEMENT: MAPE at {test_metrics['mape']:.1f}%")
        
        print("=" * 60 + "\n")
    
    def save_model(self, filepath: str):
        """Save trained model"""
        if self.estimator is None:
            raise RuntimeError("No model to save. Train model first.")
        
        self.estimator.save_model(filepath)
        
        # Save evaluation results
        results_filepath = filepath.replace('.joblib', '_eval.json')
        with open(results_filepath, 'w') as f:
            json.dump(self.evaluation_results, f, indent=2)
        
        print(f"Evaluation results saved to {results_filepath}")


# Example usage
if __name__ == "__main__":
    # Load historical data (example)
    print("Budget Estimation Model Training Example")
    print("-" * 60)
    
    # Create sample training data
    np.random.seed(42)
    n_samples = 500
    
    sample_data = pd.DataFrame({
        'description': [f"Project {i} description with various requirements" for i in range(n_samples)],
        'required_skills': [[f"skill_{j}" for j in range(np.random.randint(3, 8))] for _ in range(n_samples)],
        'final_budget': np.random.lognormal(10, 0.5, n_samples),
        'estimated_hours': np.random.randint(80, 400, n_samples),
        'complexity_level': np.random.choice(['low', 'medium', 'high'], n_samples),
        'project_type': np.random.choice(['web_app', 'mobile_app', 'api'], n_samples),
        'region': np.random.choice(['North America', 'Europe', 'Asia'], n_samples)
    })
    
    # Train model
    trainer = ModelTrainer(model_version="1.0.0")
    results = trainer.train_model(sample_data)
    
    # Save model
    trainer.save_model('models/budget_estimator_v1.joblib')
    
    print("\nTraining complete!")
