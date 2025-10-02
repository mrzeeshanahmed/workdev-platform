"""
FastAPI Budget Estimation Service
High-performance API for ML-powered budget estimation
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import time

# Import budget estimation models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from budget_estimation import BudgetEstimator, MarketRateCalculator

# ==================== Pydantic Models ====================

class ProjectDetails(BaseModel):
    """Project details for budget estimation"""
    description: str = Field(..., min_length=10, description="Project description")
    required_skills: List[str] = Field(..., min_items=1, description="Required skills")
    estimated_hours: Optional[int] = Field(160, ge=1, description="Estimated hours")
    complexity_level: Optional[str] = Field("medium", description="Complexity level")
    project_type: Optional[str] = Field("web_app", description="Project type")
    region: Optional[str] = Field("Global", description="Geographic region")
    estimated_duration_weeks: Optional[int] = Field(4, ge=1, description="Duration in weeks")
    initial_budget_min: Optional[float] = Field(None, description="Client min budget")
    initial_budget_max: Optional[float] = Field(None, description="Client max budget")
    currency: Optional[str] = Field("USD", description="Currency code")


class BudgetEstimateResponse(BaseModel):
    """Budget estimation response"""
    estimated_budget: float
    confidence_interval: Dict[str, float]
    budget_breakdown: Dict[str, float]
    market_insights: Dict[str, Any]
    recommendation: str
    model_version: str
    model_confidence_score: float
    warning_flags: List[str]
    response_time_ms: float


class MarketRateRequest(BaseModel):
    """Market rate inquiry request"""
    skills: List[str] = Field(..., min_items=1)
    region: Optional[str] = Field("Global")
    hours: Optional[int] = Field(160, ge=1)


class MarketRateResponse(BaseModel):
    """Market rate response"""
    skill_premiums: Dict[str, float]
    estimated_budget_range: Dict[str, float]
    regional_adjustment: float
    average_hourly_rate: float


class BudgetValidationRequest(BaseModel):
    """Budget validation request"""
    proposed_budget: float = Field(..., gt=0)
    project_details: ProjectDetails


class BudgetValidationResponse(BaseModel):
    """Budget validation response"""
    is_realistic: bool
    deviation_from_estimate: float
    deviation_percentage: float
    recommendation: str
    warnings: List[str]


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: Optional[str]
    model_info: Optional[Dict[str, Any]]


# ==================== FastAPI App ====================

app = FastAPI(
    title="Budget Estimation API",
    description="ML-powered project budget estimation service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
budget_estimator: Optional[BudgetEstimator] = None
market_calculator = MarketRateCalculator()

# ==================== Startup/Shutdown ====================

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    global budget_estimator
    
    model_path = os.getenv("BUDGET_MODEL_PATH", "models/budget_estimator_latest.joblib")
    
    if os.path.exists(model_path):
        try:
            budget_estimator = BudgetEstimator.load_model(model_path)
            print(f"✓ Budget estimation model loaded from {model_path}")
        except Exception as e:
            print(f"✗ Failed to load model: {e}")
            print("  Service will start but estimates won't be available")
    else:
        print(f"⚠ Model file not found at {model_path}")
        print("  Train and save a model to enable budget estimation")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("Budget Estimation API shutting down...")


# ==================== API Endpoints ====================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    model_info = None
    if budget_estimator and budget_estimator.is_trained:
        model_info = budget_estimator.get_model_info()
    
    return HealthResponse(
        status="healthy" if budget_estimator else "degraded",
        model_loaded=budget_estimator is not None and budget_estimator.is_trained,
        model_version=budget_estimator.model_version if budget_estimator else None,
        model_info=model_info
    )


@app.post("/api/v1/budget/estimate", response_model=BudgetEstimateResponse)
async def estimate_budget(project: ProjectDetails):
    """
    Estimate budget for a project
    
    Target response time: <200ms
    """
    if not budget_estimator or not budget_estimator.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Budget estimation model not available. Model needs to be trained."
        )
    
    start_time = time.time()
    
    try:
        # Convert to dict
        project_dict = project.dict()
        
        # Get estimation
        result = budget_estimator.estimate_budget(
            project_details=project_dict,
            confidence_level=0.80
        )
        
        # Calculate response time
        response_time_ms = (time.time() - start_time) * 1000
        
        # Add response time to result
        result['response_time_ms'] = round(response_time_ms, 2)
        
        return BudgetEstimateResponse(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Budget estimation failed: {str(e)}"
        )


@app.post("/api/v1/budget/market-rates", response_model=MarketRateResponse)
async def get_market_rates(request: MarketRateRequest):
    """
    Get market rates for specified skills and region
    """
    try:
        # Calculate skill premiums
        skill_premiums = market_calculator.calculate_skill_premium(
            request.skills,
            request.region
        )
        
        # Estimate budget range
        budget_min, budget_max = market_calculator.estimate_project_rate_range(
            request.skills,
            request.hours,
            request.region
        )
        
        # Calculate average hourly rate
        avg_rate = sum(skill_premiums.values()) / len(skill_premiums) if skill_premiums else 0
        
        # Get regional adjustment
        regional_adjustment = market_calculator.regional_adjustments.get(
            request.region,
            1.0
        )
        
        return MarketRateResponse(
            skill_premiums=skill_premiums,
            estimated_budget_range={
                "min": round(budget_min, 2),
                "max": round(budget_max, 2)
            },
            regional_adjustment=regional_adjustment,
            average_hourly_rate=round(avg_rate, 2)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Market rate calculation failed: {str(e)}"
        )


@app.post("/api/v1/budget/validate", response_model=BudgetValidationResponse)
async def validate_budget(request: BudgetValidationRequest):
    """
    Validate if a proposed budget is realistic
    """
    if not budget_estimator or not budget_estimator.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Budget estimation model not available"
        )
    
    try:
        # Get ML estimate
        project_dict = request.project_details.dict()
        result = budget_estimator.estimate_budget(project_dict)
        
        estimated_budget = result['estimated_budget']
        ci_lower = result['confidence_interval']['lower_bound']
        ci_upper = result['confidence_interval']['upper_bound']
        
        # Calculate deviation
        deviation = request.proposed_budget - estimated_budget
        deviation_pct = (deviation / estimated_budget * 100) if estimated_budget > 0 else 0
        
        # Determine if realistic
        is_realistic = ci_lower <= request.proposed_budget <= ci_upper
        
        # Generate recommendation
        if request.proposed_budget < ci_lower:
            recommendation = f"Proposed budget is {abs(deviation_pct):.1f}% below estimated range. This may be too low to attract quality developers."
        elif request.proposed_budget > ci_upper:
            recommendation = f"Proposed budget is {deviation_pct:.1f}% above estimated range. Consider if additional features justify the premium."
        else:
            recommendation = "Proposed budget is within the expected range and appears realistic."
        
        # Collect warnings
        warnings = []
        if deviation_pct < -30:
            warnings.append("Budget significantly below market rates - project may be underfunded")
        elif deviation_pct > 50:
            warnings.append("Budget significantly above market rates - review project scope")
        
        if request.project_details.estimated_hours:
            hourly_rate = request.proposed_budget / request.project_details.estimated_hours
            if hourly_rate < 25:
                warnings.append(f"Implied hourly rate (${hourly_rate:.2f}) is very low")
            elif hourly_rate > 200:
                warnings.append(f"Implied hourly rate (${hourly_rate:.2f}) is very high")
        
        return BudgetValidationResponse(
            is_realistic=is_realistic,
            deviation_from_estimate=round(deviation, 2),
            deviation_percentage=round(deviation_pct, 2),
            recommendation=recommendation,
            warnings=warnings
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Budget validation failed: {str(e)}"
        )


@app.post("/api/v1/model/reload")
async def reload_model(background_tasks: BackgroundTasks):
    """
    Reload model from disk (for hot-swapping)
    
    Admin endpoint - should be protected in production
    """
    global budget_estimator
    
    model_path = os.getenv("BUDGET_MODEL_PATH", "models/budget_estimator_latest.joblib")
    
    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model file not found at {model_path}"
        )
    
    try:
        budget_estimator = BudgetEstimator.load_model(model_path)
        
        return {
            "status": "success",
            "message": "Model reloaded successfully",
            "model_version": budget_estimator.model_version,
            "model_info": budget_estimator.get_model_info()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload model: {str(e)}"
        )


@app.get("/api/v1/model/info")
async def get_model_info():
    """Get current model information"""
    if not budget_estimator:
        raise HTTPException(
            status_code=503,
            detail="No model loaded"
        )
    
    return budget_estimator.get_model_info()


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8001))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
