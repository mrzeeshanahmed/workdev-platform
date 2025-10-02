"""
FastAPI ML Service for Recommendation Engine
Exposes HTTP endpoints for generating recommendations.
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import logging
from datetime import datetime
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from recommendation_engine import (
    ProjectRecommendationEngine,
    TalentRecommendationEngine,
    ColdStartRecommender,
)
from feature_extractors import FeatureExtractor

# Initialize FastAPI app
app = FastAPI(
    title="WorkDev Recommendation API",
    description="ML-powered recommendation service for developer-project matching",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instances
project_engine = ProjectRecommendationEngine()
talent_engine = TalentRecommendationEngine()
cold_start_recommender = ColdStartRecommender()
feature_extractor = FeatureExtractor()

# Model loaded flag
MODEL_LOADED = False


# ==================== Pydantic Models ====================


class DeveloperProfile(BaseModel):
    user_id: str
    skills: List[str]
    experience_level: str = Field(..., pattern="^(junior|mid|senior|expert)$")
    hourly_rate: float = Field(..., gt=0)
    preferences: Optional[Dict] = None
    average_rating: Optional[float] = Field(None, ge=0, le=5)
    completion_rate: Optional[float] = Field(None, ge=0, le=1)
    total_projects_completed: Optional[int] = Field(None, ge=0)
    availability_status: Optional[str] = "available"


class Project(BaseModel):
    id: str
    required_skills: List[str]
    complexity_level: str = Field(..., pattern="^(low|medium|high|expert)$")
    budget_range: Dict
    project_type: Optional[str] = None
    is_remote: Optional[bool] = True
    industry: Optional[str] = None
    created_at: Optional[str] = None


class ProjectRecommendationRequest(BaseModel):
    developer_id: str
    developer_profile: DeveloperProfile
    candidate_projects: List[Project]
    limit: int = Field(10, ge=1, le=50)
    hybrid_weights: Optional[Dict[str, float]] = None
    include_explanations: bool = True


class TalentRecommendationRequest(BaseModel):
    client_user_id: str
    project: Project
    candidate_developers: List[DeveloperProfile]
    limit: int = Field(10, ge=1, le=50)


class RecommendationResponse(BaseModel):
    recommendation_id: Optional[str] = None
    project_id: Optional[str] = None
    developer_user_id: Optional[str] = None
    relevance_score: float
    collaborative_score: Optional[float] = None
    content_score: Optional[float] = None
    skill_match_score: Optional[float] = None
    budget_fit_score: Optional[float] = None
    experience_match_score: Optional[float] = None
    recency_score: Optional[float] = None
    reputation_score: Optional[float] = None
    availability_score: Optional[float] = None
    rank_position: int
    explanation: List[str]
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_version: str
    model_loaded: bool
    timestamp: str


class TrainingRequest(BaseModel):
    interaction_data: List[Dict]


# ==================== Startup & Health ====================


@app.on_event("startup")
async def startup_event():
    """Load model on startup if available."""
    global MODEL_LOADED

    model_path = os.getenv("MODEL_PATH", "models/recommendation_model_latest.pkl")

    if os.path.exists(model_path):
        try:
            project_engine.load_model(model_path)
            MODEL_LOADED = True
            logger.info(f"Model loaded successfully from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            MODEL_LOADED = False
    else:
        logger.warning(f"Model file not found at {model_path}. Using cold-start recommendations.")
        MODEL_LOADED = False


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_version=project_engine.model_version,
        model_loaded=MODEL_LOADED,
        timestamp=datetime.now().isoformat(),
    )


# ==================== Recommendation Endpoints ====================


@app.post("/api/v1/recommendations/projects", response_model=List[RecommendationResponse])
async def get_project_recommendations(request: ProjectRecommendationRequest):
    """
    Generate personalized project recommendations for a developer.

    Returns a ranked list of projects with relevance scores and explanations.
    """
    try:
        # Convert Pydantic models to dicts
        developer_profile_dict = request.developer_profile.dict()
        candidate_projects_dict = [p.dict() for p in request.candidate_projects]

        # Generate recommendations
        if MODEL_LOADED:
            recommendations = project_engine.generate_project_recommendations(
                developer_id=request.developer_id,
                developer_profile=developer_profile_dict,
                candidate_projects=candidate_projects_dict,
                limit=request.limit,
                hybrid_weights=request.hybrid_weights,
            )
        else:
            # Use cold-start recommendations
            recommendations = cold_start_recommender.get_cold_start_project_recommendations(
                developer_profile=developer_profile_dict, limit=request.limit
            )

        # Convert to response models
        response = [RecommendationResponse(**rec) for rec in recommendations]

        logger.info(
            f"Generated {len(response)} project recommendations for developer {request.developer_id}"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating project recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/recommendations/talent", response_model=List[RecommendationResponse])
async def get_talent_recommendations(request: TalentRecommendationRequest):
    """
    Generate talent recommendations for a project.

    Returns a ranked list of developers with relevance scores and explanations.
    """
    try:
        # Convert Pydantic models to dicts
        project_dict = request.project.dict()
        candidate_developers_dict = [d.dict() for d in request.candidate_developers]

        # Generate recommendations
        recommendations = talent_engine.generate_talent_recommendations(
            project=project_dict,
            candidate_developers=candidate_developers_dict,
            limit=request.limit,
        )

        # Convert to response models
        response = [RecommendationResponse(**rec) for rec in recommendations]

        logger.info(
            f"Generated {len(response)} talent recommendations for project {request.project.id}"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating talent recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/recommendations/similar-projects")
async def get_similar_projects(
    project_id: str = Query(..., description="Project ID to find similar projects"),
    limit: int = Query(10, ge=1, le=50, description="Number of similar projects to return"),
):
    """
    Find similar projects based on collaborative filtering.

    Useful for "Developers who viewed this project also viewed..." features.
    """
    try:
        if not MODEL_LOADED:
            raise HTTPException(
                status_code=503,
                detail="Collaborative model not loaded. Similar projects not available.",
            )

        # TODO: Implement item-item similarity
        # This would use the item_index and similarity matrix

        return {"message": "Similar projects feature coming soon"}

    except Exception as e:
        logger.error(f"Error finding similar projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Model Management ====================


@app.post("/api/v1/model/reload")
async def reload_model():
    """
    Reload the recommendation model from disk.

    Useful for hot-swapping models without restarting the service.
    """
    global MODEL_LOADED

    try:
        model_path = os.getenv("MODEL_PATH", "models/recommendation_model_latest.pkl")

        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail=f"Model file not found: {model_path}")

        project_engine.load_model(model_path)
        MODEL_LOADED = True

        logger.info(f"Model reloaded successfully from {model_path}")

        return {
            "status": "success",
            "message": "Model reloaded successfully",
            "model_version": project_engine.model_version,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error reloading model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/model/info")
async def get_model_info():
    """
    Get information about the currently loaded model.
    """
    return {
        "model_version": project_engine.model_version,
        "model_loaded": MODEL_LOADED,
        "num_users": (
            len(project_engine.user_index) if project_engine.user_item_matrix is not None else 0
        ),
        "num_projects": (
            len(project_engine.item_index) if project_engine.user_item_matrix is not None else 0
        ),
        "matrix_sparsity": (
            1
            - (
                project_engine.user_item_matrix.astype(bool).sum().sum()
                / project_engine.user_item_matrix.size
            )
            if project_engine.user_item_matrix is not None
            else None
        ),
    }


# ==================== Feature Extraction ====================


@app.post("/api/v1/features/developer")
async def extract_developer_features(developer: DeveloperProfile):
    """
    Extract feature vector from developer profile for debugging/analysis.
    """
    try:
        features = feature_extractor.extract_developer_features(developer.dict())
        return {"features": features.tolist(), "feature_length": len(features)}
    except Exception as e:
        logger.error(f"Error extracting developer features: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/features/project")
async def extract_project_features(project: Project):
    """
    Extract feature vector from project for debugging/analysis.
    """
    try:
        features = feature_extractor.extract_project_features(project.dict())
        return {"features": features.tolist(), "feature_length": len(features)}
    except Exception as e:
        logger.error(f"Error extracting project features: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
