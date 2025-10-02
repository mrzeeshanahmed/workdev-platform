"""
Feature extraction utilities for recommendation engine.
Extracts and transforms features from user profiles and project data.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Set
from datetime import datetime
import hashlib


class FeatureExtractor:
    """Extract and transform features for ML models."""

    def __init__(self):
        self.skill_universe = set()
        self.skill_to_index = {}

    def fit_skill_vocabulary(self, all_skills: List[str]):
        """
        Build skill vocabulary from all unique skills in the platform.

        Args:
            all_skills: List of all skills across all users and projects
        """
        self.skill_universe = set(all_skills)
        self.skill_to_index = {skill: idx for idx, skill in enumerate(sorted(self.skill_universe))}

    def extract_developer_features(self, developer: Dict) -> np.ndarray:
        """
        Extract feature vector from developer profile.

        Features:
        - Skill one-hot encoding
        - Experience level (numerical)
        - Hourly rate (normalized)
        - Average rating
        - Completion rate
        - Total projects completed
        - Account age (days)
        - Response time (hours)

        Returns:
            Feature vector as numpy array
        """
        features = []

        # Skill vector (binary encoding)
        skill_vector = self._encode_skills(developer.get("skills", []))
        features.extend(skill_vector)

        # Experience level (0-1 scale)
        experience_map = {"junior": 0.25, "mid": 0.5, "senior": 0.75, "expert": 1.0}
        features.append(experience_map.get(developer.get("experience_level", "mid"), 0.5))

        # Hourly rate (normalized to 0-1, assuming range 10-200)
        hourly_rate = developer.get("hourly_rate", 50)
        features.append(min((hourly_rate - 10) / 190, 1.0))

        # Reputation features
        features.append(developer.get("average_rating", 4.0) / 5.0)  # Rating 0-1
        features.append(developer.get("completion_rate", 0.8))  # Already 0-1
        features.append(
            min(developer.get("total_projects_completed", 0) / 50, 1.0)
        )  # Normalize to 0-1

        # Activity features
        account_age = self._calculate_account_age(developer.get("created_at"))
        features.append(min(account_age / 730, 1.0))  # 2 years = 1.0

        avg_response_time = developer.get("avg_response_time_hours", 24)
        features.append(max(1.0 - (avg_response_time / 48), 0))  # Faster = higher score

        return np.array(features)

    def extract_project_features(self, project: Dict) -> np.ndarray:
        """
        Extract feature vector from project.

        Features:
        - Required skills one-hot encoding
        - Complexity level (numerical)
        - Budget (normalized)
        - Project type encoding
        - Is remote (binary)
        - Expected duration (normalized)
        - Client rating
        - Project age (days)

        Returns:
            Feature vector as numpy array
        """
        features = []

        # Skill vector
        skill_vector = self._encode_skills(project.get("required_skills", []))
        features.extend(skill_vector)

        # Complexity level
        complexity_map = {"low": 0.25, "medium": 0.5, "high": 0.75, "expert": 1.0}
        features.append(complexity_map.get(project.get("complexity_level", "medium"), 0.5))

        # Budget (using max of range, normalized)
        budget_range = project.get("budget_range", {})
        if "fixed" in budget_range:
            budget = budget_range["fixed"]
        else:
            budget = budget_range.get("max", 5000)

        features.append(min(budget / 20000, 1.0))  # Normalize to 0-1

        # Project type (one-hot for common types)
        project_types = [
            "web_development",
            "mobile_app",
            "data_science",
            "devops",
            "api_development",
        ]
        project_type = project.get("project_type", "other")
        features.extend([1 if pt == project_type else 0 for pt in project_types])

        # Remote flag
        features.append(1 if project.get("is_remote", True) else 0)

        # Expected duration (weeks, normalized)
        duration_weeks = project.get("expected_duration_weeks", 4)
        features.append(min(duration_weeks / 52, 1.0))  # Up to 1 year

        # Client reputation
        client_rating = project.get("client_rating", 4.0)
        features.append(client_rating / 5.0)

        # Project age
        project_age = self._calculate_project_age(project.get("created_at"))
        features.append(max(1.0 - (project_age / 30), 0))  # Fresher = higher score

        return np.array(features)

    def _encode_skills(self, skills: List[str]) -> List[int]:
        """
        Encode skills as binary vector based on skill vocabulary.

        Returns:
            Binary vector where 1 indicates skill presence
        """
        if not self.skill_universe:
            return []

        vector = [0] * len(self.skill_universe)

        for skill in skills:
            if skill in self.skill_to_index:
                vector[self.skill_to_index[skill]] = 1

        return vector

    def _calculate_account_age(self, created_at) -> int:
        """Calculate account age in days."""
        if not created_at:
            return 0

        if isinstance(created_at, str):
            created_at = pd.to_datetime(created_at)

        return (datetime.now() - created_at).days

    def _calculate_project_age(self, created_at) -> int:
        """Calculate project age in days."""
        return self._calculate_account_age(created_at)

    def calculate_skill_similarity(self, skills1: Set[str], skills2: Set[str]) -> float:
        """
        Calculate Jaccard similarity between two skill sets.

        Returns:
            Similarity score between 0 and 1
        """
        if not skills1 or not skills2:
            return 0.0

        intersection = len(skills1 & skills2)
        union = len(skills1 | skills2)

        return intersection / union if union > 0 else 0.0

    def extract_interaction_features(self, interaction: Dict) -> Dict[str, float]:
        """
        Extract features from a user-project interaction.

        Args:
            interaction: Dict with user_id, project_id, interaction_type, timestamp, outcome

        Returns:
            Dictionary of interaction features
        """
        features = {}

        # Interaction type weights
        type_weights = {"view": 0.2, "apply": 0.6, "hire": 1.0}
        features["interaction_strength"] = type_weights.get(
            interaction.get("interaction_type", "view"), 0.2
        )

        # Time spent on project page (if available)
        features["time_spent_seconds"] = interaction.get("time_spent_seconds", 0)

        # Interaction recency
        timestamp = interaction.get("timestamp")
        if timestamp:
            if isinstance(timestamp, str):
                timestamp = pd.to_datetime(timestamp)
            days_ago = (datetime.now() - timestamp).days
            features["recency_score"] = max(1.0 - (days_ago / 90), 0)  # Decay over 90 days
        else:
            features["recency_score"] = 0.5

        # Outcome (for supervised learning)
        features["outcome_success"] = 1 if interaction.get("outcome") == "hired" else 0

        return features

    def create_user_project_pairs(
        self, users: List[Dict], projects: List[Dict], interactions: pd.DataFrame = None
    ) -> pd.DataFrame:
        """
        Create training dataset of user-project pairs with features.

        Args:
            users: List of user profiles
            projects: List of projects
            interactions: DataFrame of historical interactions (optional)

        Returns:
            DataFrame with columns [user_id, project_id, user_features, project_features, label]
        """
        pairs = []

        if interactions is not None:
            # Create pairs from historical interactions
            user_map = {u["user_id"]: u for u in users}
            project_map = {p["id"]: p for p in projects}

            for _, interaction in interactions.iterrows():
                user_id = interaction["user_id"]
                project_id = interaction["project_id"]

                if user_id not in user_map or project_id not in project_map:
                    continue

                user_features = self.extract_developer_features(user_map[user_id])
                project_features = self.extract_project_features(project_map[project_id])

                # Label: 1 if hired, 0 otherwise
                label = 1 if interaction.get("interaction_type") == "hire" else 0

                pairs.append(
                    {
                        "user_id": user_id,
                        "project_id": project_id,
                        "user_features": user_features,
                        "project_features": project_features,
                        "label": label,
                    }
                )
        else:
            # Create all possible pairs (for prediction)
            for user in users:
                user_features = self.extract_developer_features(user)

                for project in projects:
                    project_features = self.extract_project_features(project)

                    pairs.append(
                        {
                            "user_id": user["user_id"],
                            "project_id": project["id"],
                            "user_features": user_features,
                            "project_features": project_features,
                            "label": None,  # Unknown label for prediction
                        }
                    )

        return pd.DataFrame(pairs)


class InteractionAggregator:
    """Aggregate interaction data for model training."""

    @staticmethod
    def aggregate_user_interactions(interactions: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate interactions per user to create user-level statistics.

        Returns:
            DataFrame with columns [user_id, total_views, total_applies, total_hires, avg_time_to_apply]
        """
        user_stats = (
            interactions.groupby("user_id")
            .agg(
                {
                    "interaction_type": lambda x: {
                        "total_views": (x == "view").sum(),
                        "total_applies": (x == "apply").sum(),
                        "total_hires": (x == "hire").sum(),
                    },
                    "timestamp": ["min", "max", "count"],
                }
            )
            .reset_index()
        )

        return user_stats

    @staticmethod
    def aggregate_project_interactions(interactions: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate interactions per project to create project-level statistics.

        Returns:
            DataFrame with columns [project_id, total_views, total_applies, view_to_apply_rate]
        """
        project_stats = (
            interactions.groupby("project_id")
            .agg(
                total_views=("interaction_type", lambda x: (x == "view").sum()),
                total_applies=("interaction_type", lambda x: (x == "apply").sum()),
                total_hires=("interaction_type", lambda x: (x == "hire").sum()),
            )
            .reset_index()
        )

        # Calculate conversion rates
        project_stats["view_to_apply_rate"] = (
            project_stats["total_applies"] / project_stats["total_views"]
        ).fillna(0)

        project_stats["apply_to_hire_rate"] = (
            project_stats["total_hires"] / project_stats["total_applies"]
        ).fillna(0)

        return project_stats

    @staticmethod
    def create_implicit_feedback_matrix(interactions: pd.DataFrame) -> pd.DataFrame:
        """
        Create implicit feedback matrix for collaborative filtering.

        Weights:
        - view: 1
        - apply: 3
        - hire: 5

        Returns:
            Pivot table with users as rows, projects as columns, weighted interactions as values
        """
        weight_map = {"view": 1, "apply": 3, "hire": 5}

        interactions["weight"] = interactions["interaction_type"].map(weight_map)

        # Aggregate by user-project
        feedback_matrix = interactions.pivot_table(
            index="user_id", columns="project_id", values="weight", aggfunc="sum", fill_value=0
        )

        return feedback_matrix


def hash_user_id(user_id: str, salt: str = "recommendation") -> int:
    """
    Create deterministic hash of user ID for experiment assignment.

    Returns:
        Integer hash value
    """
    hash_obj = hashlib.md5((user_id + salt).encode())
    return int(hash_obj.hexdigest(), 16)


def assign_to_ab_test(user_id: str, traffic_split: float = 0.5) -> str:
    """
    Assign user to A/B test variant using deterministic hashing.

    Args:
        user_id: User identifier
        traffic_split: Percentage of traffic for treatment (0-1)

    Returns:
        'control' or 'treatment'
    """
    hash_value = hash_user_id(user_id)
    normalized = (hash_value % 10000) / 10000

    return "treatment" if normalized < traffic_split else "control"
