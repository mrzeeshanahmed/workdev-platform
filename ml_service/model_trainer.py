"""
Model training script for recommendation engine.
Trains models on historical interaction data and evaluates performance.
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    ndcg_score,
    mean_absolute_error,
)
import logging
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from recommendation_engine import ProjectRecommendationEngine, TalentRecommendationEngine
from feature_extractors import FeatureExtractor, InteractionAggregator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelTrainer:
    """
    Train and evaluate recommendation models.
    """

    def __init__(self):
        self.project_engine = ProjectRecommendationEngine()
        self.talent_engine = TalentRecommendationEngine()
        self.feature_extractor = FeatureExtractor()

    def train_project_recommendation_model(
        self, interaction_data: pd.DataFrame, test_size: float = 0.2
    ) -> Dict:
        """
        Train project recommendation model and evaluate performance.

        Args:
            interaction_data: DataFrame with columns [user_id, project_id, interaction_type, timestamp]
            test_size: Fraction of data to use for testing

        Returns:
            Dictionary with training metrics and model performance
        """
        logger.info("Starting project recommendation model training...")

        # Split data into train and test
        train_data, test_data = train_test_split(
            interaction_data, test_size=test_size, random_state=42
        )

        logger.info(f"Train size: {len(train_data)}, Test size: {len(test_data)}")

        # Train collaborative filtering model
        training_metrics = self.project_engine.train_collaborative_model(train_data)

        # Evaluate on test set
        evaluation_metrics = self._evaluate_project_recommendations(
            test_data, k_values=[5, 10, 20]
        )

        # Combine metrics
        results = {
            "training_metrics": training_metrics,
            "evaluation_metrics": evaluation_metrics,
            "training_date": datetime.now().isoformat(),
            "model_version": self.project_engine.model_version,
        }

        logger.info(f"Training complete. Results: {results}")
        return results

    def _evaluate_project_recommendations(
        self, test_data: pd.DataFrame, k_values: list = [5, 10, 20]
    ) -> Dict:
        """
        Evaluate recommendation quality using multiple metrics.

        Metrics:
        - Precision@K: Fraction of recommended items that are relevant
        - Recall@K: Fraction of relevant items that are recommended
        - NDCG@K: Normalized Discounted Cumulative Gain
        - MAP@K: Mean Average Precision
        """
        metrics = {}

        # Group test data by user
        user_groups = test_data.groupby("user_id")

        for k in k_values:
            precisions = []
            recalls = []
            ndcgs = []

            for user_id, user_interactions in user_groups:
                # Get actual positive interactions (applies and hires)
                relevant_projects = set(
                    user_interactions[
                        user_interactions["interaction_type"].isin(["apply", "hire"])
                    ]["project_id"].values
                )

                if not relevant_projects:
                    continue

                # Get all candidate projects
                all_projects = test_data["project_id"].unique()

                # Generate recommendations (mock developer profile for testing)
                developer_profile = {
                    "user_id": user_id,
                    "skills": [],
                    "experience_level": "mid",
                    "hourly_rate": 50,
                }

                candidate_projects = [{"id": pid} for pid in all_projects]

                try:
                    recommendations = self.project_engine.generate_project_recommendations(
                        user_id, developer_profile, candidate_projects, limit=k
                    )

                    recommended_ids = [r["project_id"] for r in recommendations]

                    # Calculate precision and recall
                    relevant_recommended = len(set(recommended_ids) & relevant_projects)
                    precision = relevant_recommended / k if k > 0 else 0
                    recall = (
                        relevant_recommended / len(relevant_projects)
                        if relevant_projects
                        else 0
                    )

                    precisions.append(precision)
                    recalls.append(recall)

                    # Calculate NDCG
                    # Create relevance vector (1 for relevant, 0 for not)
                    relevance = [1 if pid in relevant_projects else 0 for pid in recommended_ids]
                    if sum(relevance) > 0:
                        ndcgs.append(
                            ndcg_score([relevance], [[1] * len(relevance)], k=len(relevance))
                        )

                except Exception as e:
                    logger.warning(f"Error generating recommendations for user {user_id}: {e}")
                    continue

            # Average metrics across users
            metrics[f"precision@{k}"] = np.mean(precisions) if precisions else 0
            metrics[f"recall@{k}"] = np.mean(recalls) if recalls else 0
            metrics[f"ndcg@{k}"] = np.mean(ndcgs) if ndcgs else 0

        # Calculate overall F1 score
        if metrics.get("precision@10") and metrics.get("recall@10"):
            metrics["f1@10"] = (
                2
                * (metrics["precision@10"] * metrics["recall@10"])
                / (metrics["precision@10"] + metrics["recall@10"])
            )
        else:
            metrics["f1@10"] = 0

        return metrics

    def calculate_business_metrics(self, interaction_data: pd.DataFrame) -> Dict:
        """
        Calculate business-relevant metrics.

        Metrics:
        - View-to-Apply conversion rate
        - Apply-to-Hire conversion rate
        - Average time to apply
        - Average time to hire
        """
        metrics = {}

        # Count interaction types
        total_views = (interaction_data["interaction_type"] == "view").sum()
        total_applies = (interaction_data["interaction_type"] == "apply").sum()
        total_hires = (interaction_data["interaction_type"] == "hire").sum()

        # Calculate conversion rates
        metrics["view_to_apply_rate"] = total_applies / total_views if total_views > 0 else 0
        metrics["apply_to_hire_rate"] = total_hires / total_applies if total_applies > 0 else 0
        metrics["overall_conversion_rate"] = total_hires / total_views if total_views > 0 else 0

        # Time-based metrics (if timestamp available)
        if "timestamp" in interaction_data.columns:
            interaction_data["timestamp"] = pd.to_datetime(interaction_data["timestamp"])

            # Calculate time to apply (time between first view and apply)
            user_project_times = interaction_data.sort_values("timestamp").groupby(
                ["user_id", "project_id"]
            )

            apply_times = []
            for (user_id, project_id), group in user_project_times:
                views = group[group["interaction_type"] == "view"]
                applies = group[group["interaction_type"] == "apply"]

                if not views.empty and not applies.empty:
                    first_view = views.iloc[0]["timestamp"]
                    first_apply = applies.iloc[0]["timestamp"]
                    time_diff_hours = (first_apply - first_view).total_seconds() / 3600
                    apply_times.append(time_diff_hours)

            metrics["avg_time_to_apply_hours"] = (
                np.mean(apply_times) if apply_times else None
            )
            metrics["median_time_to_apply_hours"] = (
                np.median(apply_times) if apply_times else None
            )

        return metrics

    def save_model(self, filepath: str):
        """Save trained model to disk."""
        self.project_engine.save_model(filepath)
        logger.info(f"Model saved to {filepath}")

    def load_model(self, filepath: str):
        """Load trained model from disk."""
        self.project_engine.load_model(filepath)
        logger.info(f"Model loaded from {filepath}")


def main():
    """
    Example training script.
    In production, this would read data from Supabase.
    """
    # Mock training data
    interaction_data = pd.DataFrame(
        {
            "user_id": ["user1", "user1", "user2", "user2", "user3"] * 100,
            "project_id": ["proj1", "proj2", "proj1", "proj3", "proj2"] * 100,
            "interaction_type": ["view", "apply", "view", "apply", "hire"] * 100,
            "timestamp": pd.date_range("2025-01-01", periods=500, freq="H"),
        }
    )

    # Initialize trainer
    trainer = ModelTrainer()

    # Train model
    results = trainer.train_project_recommendation_model(interaction_data)

    print("\n" + "=" * 50)
    print("TRAINING RESULTS")
    print("=" * 50)
    print(f"\nModel Version: {results['model_version']}")
    print(f"Training Date: {results['training_date']}")

    print("\nTraining Metrics:")
    for key, value in results["training_metrics"].items():
        print(f"  {key}: {value}")

    print("\nEvaluation Metrics:")
    for key, value in results["evaluation_metrics"].items():
        print(f"  {key}: {value:.4f}")

    # Calculate business metrics
    business_metrics = trainer.calculate_business_metrics(interaction_data)
    print("\nBusiness Metrics:")
    for key, value in business_metrics.items():
        if value is not None:
            print(f"  {key}: {value:.4f}")

    # Save model
    model_path = f"models/recommendation_model_{results['model_version']}.pkl"
    os.makedirs("models", exist_ok=True)
    trainer.save_model(model_path)
    print(f"\nModel saved to {model_path}")


if __name__ == "__main__":
    main()
