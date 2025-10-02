"""
Personalized Recommendation Engine
Implements collaborative filtering and content-based recommendation algorithms
for developer-project and client-talent matching.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import pickle
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProjectRecommendationEngine:
    """
    Main recommendation engine combining collaborative filtering
    and content-based approaches for project recommendations.
    """

    def __init__(self):
        self.similarity_model = None
        self.content_model = None
        self.scaler = StandardScaler()
        self.user_item_matrix = None
        self.user_index = {}
        self.item_index = {}
        self.model_version = f"v1.0_{datetime.now().strftime('%Y%m%d')}"

    def train_collaborative_model(self, interaction_data: pd.DataFrame) -> Dict:
        """
        Train collaborative filtering model using user-project interactions.

        Args:
            interaction_data: DataFrame with columns [user_id, project_id, interaction_type, timestamp]
                interaction_type: 'view' (1), 'apply' (3), 'hire' (5)

        Returns:
            Dictionary with training metrics
        """
        logger.info("Training collaborative filtering model...")

        # Create user-item interaction matrix
        self.user_item_matrix = self._create_interaction_matrix(interaction_data)

        # Calculate user-user similarity using cosine similarity
        self.similarity_model = cosine_similarity(self.user_item_matrix)

        # Store user and item indexes
        self.user_index = {
            user_id: idx for idx, user_id in enumerate(self.user_item_matrix.index)
        }
        self.item_index = {
            item_id: idx for idx, item_id in enumerate(self.user_item_matrix.columns)
        }

        metrics = {
            "num_users": len(self.user_index),
            "num_items": len(self.item_index),
            "sparsity": 1
            - (self.user_item_matrix.astype(bool).sum().sum() / self.user_item_matrix.size),
            "model_version": self.model_version,
        }

        logger.info(f"Collaborative model trained: {metrics}")
        return metrics

    def _create_interaction_matrix(self, interaction_data: pd.DataFrame) -> pd.DataFrame:
        """
        Create user-item interaction matrix with weighted interactions.

        Interaction weights:
        - view: 1
        - apply: 3
        - hire: 5
        """
        # Map interaction types to weights
        weight_map = {"view": 1, "apply": 3, "hire": 5}

        interaction_data["weight"] = interaction_data["interaction_type"].map(weight_map)

        # Aggregate interactions by user-project
        matrix_data = (
            interaction_data.groupby(["user_id", "project_id"])["weight"].sum().unstack(fill_value=0)
        )

        return matrix_data

    def calculate_collaborative_scores(
        self, user_id: str, candidate_projects: List[str], top_k_similar: int = 50
    ) -> Dict[str, float]:
        """
        Calculate collaborative filtering scores for candidate projects.

        Args:
            user_id: Target user ID
            candidate_projects: List of project IDs to score
            top_k_similar: Number of similar users to consider

        Returns:
            Dictionary mapping project_id to collaborative score
        """
        if self.similarity_model is None or user_id not in self.user_index:
            # Cold start: return neutral scores
            return {project_id: 0.5 for project_id in candidate_projects}

        user_idx = self.user_index[user_id]

        # Get top-k similar users (excluding self)
        similarity_scores = self.similarity_model[user_idx]
        similar_user_indices = np.argsort(similarity_scores)[::-1][1 : top_k_similar + 1]

        scores = {}
        for project_id in candidate_projects:
            if project_id not in self.item_index:
                scores[project_id] = 0.5  # Neutral score for new items
                continue

            project_idx = self.item_index[project_id]

            # Calculate weighted average of similar users' interactions
            numerator = 0
            denominator = 0

            for similar_idx in similar_user_indices:
                similarity = similarity_scores[similar_idx]
                interaction = self.user_item_matrix.iloc[similar_idx, project_idx]

                if interaction > 0:
                    numerator += similarity * interaction
                    denominator += similarity

            if denominator > 0:
                score = numerator / denominator
                # Normalize to 0-1 range
                scores[project_id] = min(score / 10.0, 1.0)
            else:
                scores[project_id] = 0.5

        return scores

    def calculate_content_scores(
        self, developer_profile: Dict, projects: List[Dict]
    ) -> Dict[str, Dict]:
        """
        Calculate content-based scores using profile-project matching.

        Args:
            developer_profile: Dict with keys [skills, experience_level, hourly_rate, preferences]
            projects: List of project dicts with [id, required_skills, complexity, budget_range]

        Returns:
            Dictionary mapping project_id to score breakdown
        """
        scores = {}

        developer_skills = set(developer_profile.get("skills", []))
        experience_level = developer_profile.get("experience_level", "mid")
        hourly_rate = developer_profile.get("hourly_rate", 50)
        preferences = developer_profile.get("preferences", {})

        for project in projects:
            project_id = project["id"]

            # Skill match score
            required_skills = set(project.get("required_skills", []))
            if len(required_skills) > 0:
                skill_overlap = len(developer_skills & required_skills)
                skill_match = skill_overlap / len(required_skills)
            else:
                skill_match = 0.5

            # Experience match score
            experience_match = self._calculate_experience_fit(
                experience_level, project.get("complexity_level", "medium")
            )

            # Budget fit score
            budget_fit = self._calculate_budget_alignment(
                hourly_rate, project.get("budget_range", {})
            )

            # Recency bonus (newer projects get slight boost)
            recency_score = self._calculate_recency_score(project.get("created_at"))

            # Preference match (project type, remote vs onsite, etc.)
            preference_match = self._calculate_preference_match(preferences, project)

            # Composite score with weights
            composite_score = (
                skill_match * 0.35
                + experience_match * 0.20
                + budget_fit * 0.25
                + recency_score * 0.10
                + preference_match * 0.10
            )

            scores[project_id] = {
                "skill_match": round(skill_match, 4),
                "experience_match": round(experience_match, 4),
                "budget_fit": round(budget_fit, 4),
                "recency_score": round(recency_score, 4),
                "preference_match": round(preference_match, 4),
                "composite_score": round(composite_score, 4),
            }

        return scores

    def _calculate_skill_overlap(
        self, developer_skills: set, required_skills: set
    ) -> float:
        """Calculate Jaccard similarity for skills."""
        if not required_skills:
            return 0.5

        intersection = len(developer_skills & required_skills)
        union = len(developer_skills | required_skills)

        return intersection / union if union > 0 else 0

    def _calculate_experience_fit(
        self, developer_level: str, project_complexity: str
    ) -> float:
        """
        Calculate experience-complexity match.

        Levels: junior, mid, senior, expert
        Complexity: low, medium, high, expert
        """
        level_map = {"junior": 1, "mid": 2, "senior": 3, "expert": 4}
        complexity_map = {"low": 1, "medium": 2, "high": 3, "expert": 4}

        dev_level = level_map.get(developer_level, 2)
        proj_complexity = complexity_map.get(project_complexity, 2)

        # Perfect match = 1.0, one level off = 0.7, two+ levels = 0.4
        diff = abs(dev_level - proj_complexity)
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.7
        else:
            return 0.4

    def _calculate_budget_alignment(self, hourly_rate: float, budget_range: Dict) -> float:
        """
        Calculate budget alignment score.

        Args:
            hourly_rate: Developer's hourly rate
            budget_range: Dict with 'min' and 'max' budget or 'fixed' budget
        """
        if not budget_range:
            return 0.5

        if "fixed" in budget_range:
            # For fixed budget, estimate hours and compare
            fixed_budget = budget_range["fixed"]
            estimated_hours = budget_range.get("estimated_hours", 40)
            implicit_rate = fixed_budget / estimated_hours

            rate_ratio = min(implicit_rate, hourly_rate) / max(implicit_rate, hourly_rate)
            return rate_ratio

        budget_min = budget_range.get("min", 0)
        budget_max = budget_range.get("max", float("inf"))

        if budget_min <= hourly_rate <= budget_max:
            # Within range: score based on position in range
            if budget_max == float("inf"):
                return 1.0
            position = (hourly_rate - budget_min) / (budget_max - budget_min)
            # Prefer middle of range
            return 1.0 - abs(0.5 - position) * 0.4

        # Outside range
        if hourly_rate < budget_min:
            # Developer costs less (good for client, but might signal skill mismatch)
            return 0.8
        else:
            # Developer costs more (less likely to match)
            ratio = budget_max / hourly_rate
            return max(ratio * 0.6, 0.2)

    def _calculate_recency_score(self, created_at: Optional[datetime]) -> float:
        """
        Give slight boost to newer projects.

        Projects < 7 days: 1.0
        Projects < 14 days: 0.9
        Projects < 30 days: 0.8
        Projects older: 0.7
        """
        if not created_at:
            return 0.7

        if isinstance(created_at, str):
            created_at = pd.to_datetime(created_at)

        days_old = (datetime.now() - created_at).days

        if days_old < 7:
            return 1.0
        elif days_old < 14:
            return 0.9
        elif days_old < 30:
            return 0.8
        else:
            return 0.7

    def _calculate_preference_match(self, preferences: Dict, project: Dict) -> float:
        """
        Calculate match based on user preferences.

        Preferences: project_types, remote_preference, industry_preference
        """
        score = 0.5  # Neutral baseline
        matches = 0
        total_prefs = 0

        # Project type preference
        if "project_types" in preferences and "project_type" in project:
            total_prefs += 1
            if project["project_type"] in preferences["project_types"]:
                matches += 1

        # Remote preference
        if "remote_preference" in preferences and "is_remote" in project:
            total_prefs += 1
            pref_remote = preferences["remote_preference"]
            is_remote = project["is_remote"]

            if (pref_remote == "remote_only" and is_remote) or (
                pref_remote == "hybrid" or pref_remote == "no_preference"
            ):
                matches += 1
            elif pref_remote == "onsite_only" and not is_remote:
                matches += 1

        # Industry preference
        if "industries" in preferences and "industry" in project:
            total_prefs += 1
            if project["industry"] in preferences["industries"]:
                matches += 1

        if total_prefs > 0:
            score = matches / total_prefs

        return score

    def generate_project_recommendations(
        self,
        developer_id: str,
        developer_profile: Dict,
        candidate_projects: List[Dict],
        limit: int = 10,
        hybrid_weights: Dict[str, float] = None,
    ) -> List[Dict]:
        """
        Generate hybrid recommendations combining collaborative and content-based scores.

        Args:
            developer_id: Target developer user ID
            developer_profile: Developer profile dict
            candidate_projects: List of open projects to consider
            limit: Number of recommendations to return
            hybrid_weights: Dict with 'collaborative' and 'content' weights (default 0.6/0.4)

        Returns:
            List of recommendation dicts with scores and explanations
        """
        if hybrid_weights is None:
            hybrid_weights = {"collaborative": 0.6, "content": 0.4}

        # Get collaborative scores
        project_ids = [p["id"] for p in candidate_projects]
        collaborative_scores = self.calculate_collaborative_scores(developer_id, project_ids)

        # Get content-based scores
        content_scores = self.calculate_content_scores(developer_profile, candidate_projects)

        # Combine scores
        recommendations = []
        for project in candidate_projects:
            project_id = project["id"]

            collab_score = collaborative_scores.get(project_id, 0.5)
            content_breakdown = content_scores.get(project_id, {})
            content_score = content_breakdown.get("composite_score", 0.5)

            # Hybrid score
            relevance_score = (
                collab_score * hybrid_weights["collaborative"]
                + content_score * hybrid_weights["content"]
            )

            # Generate explanation
            explanation = self._generate_explanation(
                content_breakdown, collab_score, developer_profile, project
            )

            recommendations.append(
                {
                    "project_id": project_id,
                    "relevance_score": round(relevance_score, 4),
                    "collaborative_score": round(collab_score, 4),
                    "content_score": round(content_score, 4),
                    "skill_match_score": content_breakdown.get("skill_match", 0.5),
                    "budget_fit_score": content_breakdown.get("budget_fit", 0.5),
                    "experience_match_score": content_breakdown.get("experience_match", 0.5),
                    "recency_score": content_breakdown.get("recency_score", 0.7),
                    "explanation": explanation,
                    "model_version": self.model_version,
                }
            )

        # Sort by relevance and rank
        recommendations.sort(key=lambda x: x["relevance_score"], reverse=True)

        # Add rank position
        for idx, rec in enumerate(recommendations[:limit]):
            rec["rank_position"] = idx + 1

        return recommendations[:limit]

    def _generate_explanation(
        self, content_breakdown: Dict, collab_score: float, profile: Dict, project: Dict
    ) -> List[str]:
        """
        Generate human-readable explanation for recommendation.
        """
        explanation = []

        # Skill match
        skill_match = content_breakdown.get("skill_match", 0)
        if skill_match > 0.7:
            explanation.append(f"Strong skill match ({int(skill_match * 100)}%)")
        elif skill_match > 0.5:
            explanation.append(f"Good skill match ({int(skill_match * 100)}%)")

        # Budget alignment
        budget_fit = content_breakdown.get("budget_fit", 0)
        if budget_fit > 0.8:
            explanation.append("Budget aligns with your rate")

        # Experience level
        experience_match = content_breakdown.get("experience_match", 0)
        if experience_match >= 0.7:
            explanation.append("Project complexity matches your experience")

        # Collaborative signal
        if collab_score > 0.7:
            explanation.append("Developers with similar profiles have applied")

        # Recency
        recency = content_breakdown.get("recency_score", 0)
        if recency >= 1.0:
            explanation.append("Recently posted project")

        if not explanation:
            explanation.append("Matches your general profile")

        return explanation

    def save_model(self, filepath: str):
        """Save trained model to disk."""
        model_data = {
            "similarity_model": self.similarity_model,
            "user_item_matrix": self.user_item_matrix,
            "user_index": self.user_index,
            "item_index": self.item_index,
            "model_version": self.model_version,
            "saved_at": datetime.now().isoformat(),
        }

        with open(filepath, "wb") as f:
            pickle.dump(model_data, f)

        logger.info(f"Model saved to {filepath}")

    def load_model(self, filepath: str):
        """Load trained model from disk."""
        with open(filepath, "rb") as f:
            model_data = pickle.load(f)

        self.similarity_model = model_data["similarity_model"]
        self.user_item_matrix = model_data["user_item_matrix"]
        self.user_index = model_data["user_index"]
        self.item_index = model_data["item_index"]
        self.model_version = model_data["model_version"]

        logger.info(f"Model loaded from {filepath} (version: {self.model_version})")


class TalentRecommendationEngine:
    """
    Recommendation engine for suggesting developers to clients.
    """

    def __init__(self):
        self.model_version = f"v1.0_{datetime.now().strftime('%Y%m%d')}"

    def generate_talent_recommendations(
        self, project: Dict, candidate_developers: List[Dict], limit: int = 10
    ) -> List[Dict]:
        """
        Generate talent recommendations for a project.

        Args:
            project: Project dict with required_skills, budget, complexity
            candidate_developers: List of available developer profiles
            limit: Number of recommendations to return

        Returns:
            List of developer recommendation dicts
        """
        recommendations = []

        required_skills = set(project.get("required_skills", []))
        project_complexity = project.get("complexity_level", "medium")
        budget_range = project.get("budget_range", {})

        for developer in candidate_developers:
            dev_skills = set(developer.get("skills", []))

            # Skill match
            if required_skills:
                skill_overlap = len(dev_skills & required_skills)
                skill_match = skill_overlap / len(required_skills)
            else:
                skill_match = 0.5

            # Experience match
            experience_match = self._calculate_experience_fit(
                developer.get("experience_level", "mid"), project_complexity
            )

            # Budget alignment
            hourly_rate = developer.get("hourly_rate", 50)
            budget_fit = self._calculate_budget_alignment(hourly_rate, budget_range)

            # Reputation score (from reviews)
            reputation_score = self._calculate_reputation_score(developer)

            # Availability score
            availability_score = self._calculate_availability_score(developer)

            # Composite score
            relevance_score = (
                skill_match * 0.35
                + experience_match * 0.20
                + budget_fit * 0.20
                + reputation_score * 0.15
                + availability_score * 0.10
            )

            # Generate explanation
            explanation = self._generate_talent_explanation(
                skill_match, experience_match, budget_fit, reputation_score, developer
            )

            recommendations.append(
                {
                    "developer_user_id": developer["user_id"],
                    "relevance_score": round(relevance_score, 4),
                    "skill_match_score": round(skill_match, 4),
                    "experience_match_score": round(experience_match, 4),
                    "budget_fit_score": round(budget_fit, 4),
                    "reputation_score": round(reputation_score, 4),
                    "availability_score": round(availability_score, 4),
                    "explanation": explanation,
                    "model_version": self.model_version,
                }
            )

        # Sort and rank
        recommendations.sort(key=lambda x: x["relevance_score"], reverse=True)

        for idx, rec in enumerate(recommendations[:limit]):
            rec["rank_position"] = idx + 1

        return recommendations[:limit]

    def _calculate_experience_fit(self, dev_level: str, complexity: str) -> float:
        """Same as ProjectRecommendationEngine."""
        level_map = {"junior": 1, "mid": 2, "senior": 3, "expert": 4}
        complexity_map = {"low": 1, "medium": 2, "high": 3, "expert": 4}

        dev_level_num = level_map.get(dev_level, 2)
        complexity_num = complexity_map.get(complexity, 2)

        diff = abs(dev_level_num - complexity_num)
        if diff == 0:
            return 1.0
        elif diff == 1:
            return 0.7
        else:
            return 0.4

    def _calculate_budget_alignment(self, hourly_rate: float, budget_range: Dict) -> float:
        """Same as ProjectRecommendationEngine."""
        if not budget_range:
            return 0.5

        budget_min = budget_range.get("min", 0)
        budget_max = budget_range.get("max", float("inf"))

        if budget_min <= hourly_rate <= budget_max:
            return 1.0
        elif hourly_rate < budget_min:
            return 0.8
        else:
            ratio = budget_max / hourly_rate
            return max(ratio * 0.6, 0.2)

    def _calculate_reputation_score(self, developer: Dict) -> float:
        """
        Calculate reputation score from review history.
        """
        avg_rating = developer.get("average_rating", 4.0)
        total_reviews = developer.get("total_reviews", 0)
        completion_rate = developer.get("completion_rate", 0.8)

        # Normalize rating to 0-1
        rating_score = (avg_rating - 1) / 4.0  # Scale 1-5 to 0-1

        # Reviews credibility boost
        review_credibility = min(total_reviews / 20, 1.0)  # Max boost at 20 reviews

        # Combine
        reputation = rating_score * 0.6 + completion_rate * 0.3 + review_credibility * 0.1

        return min(reputation, 1.0)

    def _calculate_availability_score(self, developer: Dict) -> float:
        """
        Calculate availability based on current workload and status.
        """
        availability_status = developer.get("availability_status", "unknown")

        status_scores = {"available": 1.0, "partially_available": 0.7, "busy": 0.3, "unknown": 0.5}

        return status_scores.get(availability_status, 0.5)

    def _generate_talent_explanation(
        self,
        skill_match: float,
        experience_match: float,
        budget_fit: float,
        reputation: float,
        developer: Dict,
    ) -> List[str]:
        """Generate explanation for talent recommendation."""
        explanation = []

        if skill_match > 0.7:
            explanation.append(f"Strong skill match ({int(skill_match * 100)}%)")

        if experience_match >= 0.7:
            explanation.append("Experience level matches project complexity")

        if budget_fit > 0.8:
            explanation.append("Rate within your budget")

        if reputation > 0.8:
            avg_rating = developer.get("average_rating", 4.0)
            explanation.append(f"Highly rated ({avg_rating:.1f}/5.0)")

        if developer.get("availability_status") == "available":
            explanation.append("Currently available")

        if not explanation:
            explanation.append("Matches project requirements")

        return explanation


class ColdStartRecommender:
    """
    Handles recommendations for new users with no interaction history.
    """

    def __init__(self):
        self.popular_projects = []
        self.popular_developers = []

    def set_popular_items(self, projects: List[Dict], developers: List[Dict]):
        """
        Set popular items based on platform-wide statistics.

        Args:
            projects: Top projects by application count
            developers: Top developers by hire count
        """
        self.popular_projects = projects
        self.popular_developers = developers

    def get_cold_start_project_recommendations(
        self, developer_profile: Dict, limit: int = 10
    ) -> List[Dict]:
        """
        Generate recommendations for new developers using popularity + basic matching.
        """
        recommendations = []

        dev_skills = set(developer_profile.get("skills", []))

        for project in self.popular_projects:
            required_skills = set(project.get("required_skills", []))

            # Basic skill match
            if required_skills:
                skill_match = len(dev_skills & required_skills) / len(required_skills)
            else:
                skill_match = 0.5

            # Popularity score
            application_count = project.get("application_count", 0)
            popularity_score = min(application_count / 50, 1.0)  # Normalize

            # Hybrid: 70% popularity, 30% skill match for cold start
            relevance_score = popularity_score * 0.7 + skill_match * 0.3

            recommendations.append(
                {
                    "project_id": project["id"],
                    "relevance_score": round(relevance_score, 4),
                    "skill_match_score": round(skill_match, 4),
                    "explanation": [
                        "Popular project on the platform",
                        f"Matches {int(skill_match * 100)}% of your skills",
                    ],
                    "model_version": "cold_start_v1",
                }
            )

        recommendations.sort(key=lambda x: x["relevance_score"], reverse=True)

        for idx, rec in enumerate(recommendations[:limit]):
            rec["rank_position"] = idx + 1

        return recommendations[:limit]
