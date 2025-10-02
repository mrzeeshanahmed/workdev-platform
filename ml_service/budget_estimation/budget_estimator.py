"""
Budget Estimation ML Model
Machine learning models for predicting project budgets with confidence intervals
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple, Optional
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import cross_val_score
import joblib
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from .feature_engineering import ProjectFeatureExtractor, MarketRateCalculator


class BudgetEstimator:
    """Main budget estimation model with confidence intervals"""
    
    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.feature_extractor = ProjectFeatureExtractor()
        self.market_calculator = MarketRateCalculator()
        
        # Primary prediction model (ensemble)
        self.base_models = [
            RandomForestRegressor(
                n_estimators=200,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            ),
            GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            ),
            Ridge(alpha=1.0, random_state=42)
        ]
        
        self.ensemble_weights = [0.5, 0.3, 0.2]  # Weights for ensemble
        
        # Uncertainty estimation model
        self.uncertainty_model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        # Model metadata
        self.is_trained = False
        self.training_date = None
        self.training_samples = 0
        self.feature_importance = None
        
    def train(self, training_data: pd.DataFrame) -> Dict[str, float]:
        """
        Train the budget estimation model
        
        Args:
            training_data: DataFrame with historical project data
            
        Returns:
            Training metrics
        """
        print(f"Training budget estimation model v{self.model_version}...")
        
        # Validate training data
        if len(training_data) < 50:
            raise ValueError("Insufficient training data. Need at least 50 samples.")
        
        # Extract features and target
        X = self.feature_extractor.extract_features(training_data, fit=True)
        y = training_data['final_budget'].values
        
        # Train base models
        for i, model in enumerate(self.base_models):
            print(f"Training base model {i+1}/{len(self.base_models)}...")
            model.fit(X, y)
        
        # Generate predictions for uncertainty estimation
        predictions = self._ensemble_predict(X)
        prediction_errors = np.abs(predictions - y)
        
        # Train uncertainty model
        print("Training uncertainty estimation model...")
        self.uncertainty_model.fit(X, prediction_errors)
        
        # Calculate feature importance (from Random Forest)
        if hasattr(self.base_models[0], 'feature_importances_'):
            self.feature_importance = self.base_models[0].feature_importances_
        
        # Update metadata
        self.is_trained = True
        self.training_date = datetime.now()
        self.training_samples = len(training_data)
        
        # Calculate training metrics
        metrics = self._calculate_metrics(y, predictions, prediction_errors)
        
        print(f"Training complete! MAE: {metrics['mae']:.2f}, R²: {metrics['r2']:.4f}")
        
        return metrics
    
    def _ensemble_predict(self, X: np.ndarray) -> np.ndarray:
        """Make ensemble predictions using weighted average"""
        predictions = []
        
        for model in self.base_models:
            pred = model.predict(X)
            predictions.append(pred)
        
        # Weighted average
        ensemble_pred = np.average(predictions, axis=0, weights=self.ensemble_weights)
        
        return ensemble_pred
    
    def estimate_budget(
        self, 
        project_details: Dict[str, Any],
        confidence_level: float = 0.80
    ) -> Dict[str, Any]:
        """
        Estimate budget for a new project
        
        Args:
            project_details: Project information
            confidence_level: Confidence level for interval (default 0.80)
            
        Returns:
            Budget estimation with confidence intervals and breakdown
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before making predictions")
        
        # Extract features
        features = self.feature_extractor.extract_single_project_features(project_details)
        
        # Generate base prediction
        base_estimate = self._ensemble_predict(features.reshape(1, -1))[0]
        
        # Estimate uncertainty
        error_estimate = self.uncertainty_model.predict(features.reshape(1, -1))[0]
        
        # Calculate confidence interval based on confidence level
        z_score = self._get_z_score(confidence_level)
        margin = error_estimate * z_score
        
        confidence_interval = {
            'lower_bound': max(0, base_estimate - margin),
            'upper_bound': base_estimate + margin,
            'confidence_level': confidence_level
        }
        
        # Generate budget breakdown
        breakdown = self._generate_budget_breakdown(
            project_details, 
            base_estimate
        )
        
        # Get market insights
        market_insights = self._get_market_insights(project_details, base_estimate)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(
            base_estimate,
            error_estimate,
            project_details,
            market_insights
        )
        
        # Calculate model confidence score
        confidence_score = self._calculate_confidence_score(
            project_details,
            error_estimate,
            base_estimate
        )
        
        return {
            'estimated_budget': round(base_estimate, 2),
            'confidence_interval': {
                'lower_bound': round(confidence_interval['lower_bound'], 2),
                'upper_bound': round(confidence_interval['upper_bound'], 2),
                'confidence_level': confidence_level
            },
            'budget_breakdown': breakdown,
            'market_insights': market_insights,
            'recommendation': recommendation,
            'model_version': self.model_version,
            'model_confidence_score': round(confidence_score, 2),
            'warning_flags': self._check_warning_flags(project_details, base_estimate)
        }
    
    def _generate_budget_breakdown(
        self, 
        project_details: Dict[str, Any], 
        total_budget: float
    ) -> Dict[str, float]:
        """Generate phase-wise budget breakdown"""
        # Get project type and complexity
        project_type = project_details.get('project_type', 'web_app').lower()
        complexity = project_details.get('complexity_level', 'medium').lower()
        
        # Phase distribution templates
        phase_distributions = {
            'web_app': {
                'planning_and_design': 0.15,
                'development': 0.50,
                'testing_and_qa': 0.15,
                'deployment_and_launch': 0.05,
                'buffer_contingency': 0.15
            },
            'mobile_app': {
                'planning_and_design': 0.20,
                'development': 0.45,
                'testing_and_qa': 0.20,
                'deployment_and_launch': 0.05,
                'buffer_contingency': 0.10
            },
            'api': {
                'planning_and_design': 0.10,
                'development': 0.60,
                'testing_and_qa': 0.15,
                'deployment_and_launch': 0.05,
                'buffer_contingency': 0.10
            },
            'data': {
                'planning_and_design': 0.25,
                'development': 0.40,
                'testing_and_qa': 0.20,
                'deployment_and_launch': 0.05,
                'buffer_contingency': 0.10
            },
            'default': {
                'planning_and_design': 0.15,
                'development': 0.50,
                'testing_and_qa': 0.15,
                'deployment_and_launch': 0.05,
                'buffer_contingency': 0.15
            }
        }
        
        # Select appropriate distribution
        distribution = phase_distributions.get(project_type, phase_distributions['default'])
        
        # Adjust buffer based on complexity
        complexity_buffer_adjustment = {
            'low': -0.05,
            'medium': 0.0,
            'high': 0.05,
            'expert': 0.10
        }
        
        buffer_adjustment = complexity_buffer_adjustment.get(complexity, 0.0)
        distribution['buffer_contingency'] += buffer_adjustment
        distribution['development'] -= buffer_adjustment  # Compensate
        
        # Calculate breakdown
        breakdown = {
            phase: round(total_budget * percentage, 2)
            for phase, percentage in distribution.items()
        }
        
        return breakdown
    
    def _get_market_insights(
        self, 
        project_details: Dict[str, Any], 
        estimated_budget: float
    ) -> Dict[str, Any]:
        """Generate market insights for the project"""
        skills = project_details.get('required_skills', [])
        region = project_details.get('region', 'Global')
        hours = project_details.get('estimated_hours', 160)
        
        # Get skill premiums
        skill_premiums = self.market_calculator.calculate_skill_premium(skills, region)
        
        # Calculate similar projects average (simulated - in production, query DB)
        similar_projects_avg = estimated_budget * np.random.uniform(0.9, 1.1)
        
        # Regional adjustment factor
        regional_adjustment = self.market_calculator.regional_adjustments.get(region, 1.0)
        
        # Market demand factor (simulated - in production, calculate from recent data)
        market_demand_factor = 1.0
        if any(skill.lower() in ['ai', 'ml', 'blockchain', 'web3'] for skill in skills):
            market_demand_factor = 1.2
        
        return {
            'similar_projects_avg': round(similar_projects_avg, 2),
            'skill_premium_factors': {
                skill: round(premium, 2) 
                for skill, premium in skill_premiums.items()
            },
            'regional_adjustment': round(regional_adjustment, 2),
            'market_demand_factor': round(market_demand_factor, 2),
            'average_hourly_rate': round(estimated_budget / hours if hours > 0 else 0, 2)
        }
    
    def _generate_recommendation(
        self,
        estimated_budget: float,
        error_estimate: float,
        project_details: Dict[str, Any],
        market_insights: Dict[str, Any]
    ) -> str:
        """Generate budget recommendation text"""
        # Calculate uncertainty ratio
        uncertainty_ratio = error_estimate / estimated_budget if estimated_budget > 0 else 1.0
        
        recommendations = []
        
        # Budget confidence
        if uncertainty_ratio < 0.1:
            recommendations.append("High confidence in budget estimate based on similar historical projects.")
        elif uncertainty_ratio < 0.2:
            recommendations.append("Moderate confidence in estimate. Consider the confidence interval.")
        else:
            recommendations.append("Lower confidence due to unique project characteristics. Budget may vary significantly.")
        
        # Market comparison
        market_avg = market_insights.get('similar_projects_avg', 0)
        if estimated_budget > market_avg * 1.2:
            recommendations.append("Budget is above market average for similar projects. Consider reviewing scope or requirements.")
        elif estimated_budget < market_avg * 0.8:
            recommendations.append("Budget is below market average. Ensure realistic expectations with developers.")
        
        # Complexity considerations
        complexity = project_details.get('complexity_level', 'medium').lower()
        if complexity in ['high', 'expert']:
            recommendations.append("Complex project - recommend adding 15-20% contingency buffer.")
        
        # Skills availability
        skills = project_details.get('required_skills', [])
        high_demand_skills = ['ai', 'ml', 'blockchain', 'web3', 'rust']
        if any(skill.lower() in high_demand_skills for skill in skills):
            recommendations.append("High-demand skills may command premium rates. Budget reflects current market premiums.")
        
        return " ".join(recommendations)
    
    def _calculate_confidence_score(
        self,
        project_details: Dict[str, Any],
        error_estimate: float,
        base_estimate: float
    ) -> float:
        """Calculate overall confidence score (0-1)"""
        # Base confidence from error ratio
        error_ratio = error_estimate / base_estimate if base_estimate > 0 else 1.0
        error_confidence = max(0, 1 - error_ratio)
        
        # Adjust for data completeness
        completeness_score = 0.0
        required_fields = ['description', 'required_skills', 'estimated_hours', 'complexity_level']
        provided_fields = sum(1 for field in required_fields if project_details.get(field))
        completeness_score = provided_fields / len(required_fields)
        
        # Combined confidence
        confidence = (error_confidence * 0.7) + (completeness_score * 0.3)
        
        return min(1.0, max(0.0, confidence))
    
    def _check_warning_flags(
        self,
        project_details: Dict[str, Any],
        estimated_budget: float
    ) -> List[str]:
        """Check for warning flags in the estimation"""
        warnings = []
        
        # Check for missing critical information
        if not project_details.get('description'):
            warnings.append("Missing project description - estimate may be inaccurate")
        
        if not project_details.get('required_skills'):
            warnings.append("No skills specified - using general estimates")
        
        # Check for unrealistic estimates
        hours = project_details.get('estimated_hours', 0)
        if hours > 0:
            hourly_rate = estimated_budget / hours
            if hourly_rate > 200:
                warnings.append("Estimated hourly rate exceeds $200 - verify project requirements")
            elif hourly_rate < 20:
                warnings.append("Estimated hourly rate below $20 - may be unrealistic")
        
        # Check budget ranges
        budget_min = project_details.get('initial_budget_min', 0)
        budget_max = project_details.get('initial_budget_max', 0)
        if budget_max > 0 and (estimated_budget < budget_min or estimated_budget > budget_max):
            warnings.append("Estimate outside provided budget range - review project scope")
        
        return warnings
    
    def _get_z_score(self, confidence_level: float) -> float:
        """Get z-score for confidence level"""
        z_scores = {
            0.50: 0.674,
            0.60: 0.842,
            0.70: 1.036,
            0.80: 1.282,
            0.90: 1.645,
            0.95: 1.960,
            0.99: 2.576
        }
        return z_scores.get(confidence_level, 1.282)
    
    def _calculate_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        errors: np.ndarray
    ) -> Dict[str, float]:
        """Calculate model performance metrics"""
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        
        # Calculate MAPE (Mean Absolute Percentage Error)
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        
        # Calculate accuracy within 10%
        within_10_percent = np.mean(np.abs((y_true - y_pred) / y_true) <= 0.10) * 100
        
        return {
            'mae': mae,
            'rmse': rmse,
            'r2': r2,
            'mape': mape,
            'within_10_percent_accuracy': within_10_percent
        }
    
    def save_model(self, filepath: str):
        """Save trained model to disk"""
        if not self.is_trained:
            raise RuntimeError("Cannot save untrained model")
        
        model_data = {
            'model_version': self.model_version,
            'base_models': self.base_models,
            'ensemble_weights': self.ensemble_weights,
            'uncertainty_model': self.uncertainty_model,
            'feature_extractor': self.feature_extractor,
            'market_calculator': self.market_calculator,
            'training_date': self.training_date,
            'training_samples': self.training_samples,
            'feature_importance': self.feature_importance
        }
        
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    @classmethod
    def load_model(cls, filepath: str) -> 'BudgetEstimator':
        """Load trained model from disk"""
        model_data = joblib.load(filepath)
        
        estimator = cls(model_version=model_data['model_version'])
        estimator.base_models = model_data['base_models']
        estimator.ensemble_weights = model_data['ensemble_weights']
        estimator.uncertainty_model = model_data['uncertainty_model']
        estimator.feature_extractor = model_data['feature_extractor']
        estimator.market_calculator = model_data['market_calculator']
        estimator.training_date = model_data['training_date']
        estimator.training_samples = model_data['training_samples']
        estimator.feature_importance = model_data.get('feature_importance')
        estimator.is_trained = True
        
        print(f"Model loaded from {filepath}")
        print(f"Version: {estimator.model_version}, Trained: {estimator.training_date}")
        
        return estimator
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata and information"""
        return {
            'model_version': self.model_version,
            'is_trained': self.is_trained,
            'training_date': self.training_date.isoformat() if self.training_date else None,
            'training_samples': self.training_samples,
            'base_models': [type(model).__name__ for model in self.base_models],
            'ensemble_weights': self.ensemble_weights,
            'feature_count': len(self.feature_extractor.get_feature_names()) if self.is_trained else 0
        }
