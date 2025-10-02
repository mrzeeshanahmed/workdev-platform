"""
Budget Estimation Feature Engineering
Extracts and engineers features from project data for ML models
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler, LabelEncoder
import re
import json


class ProjectFeatureExtractor:
    """Extract and engineer features from project data"""
    
    def __init__(self):
        self.description_vectorizer = TfidfVectorizer(
            max_features=500,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=2
        )
        self.skill_encoder = None
        self.scaler = StandardScaler()
        self.region_encoder = LabelEncoder()
        self.type_encoder = LabelEncoder()
        
        # Skill categories and premiums
        self.skill_categories = self._initialize_skill_categories()
        self.tech_stack_complexity = self._initialize_tech_complexity()
        
    def _initialize_skill_categories(self) -> Dict[str, List[str]]:
        """Initialize skill categories for feature engineering"""
        return {
            'frontend': ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'next.js'],
            'backend': ['node.js', 'python', 'java', 'golang', 'rust', 'php', 'ruby', '.net'],
            'mobile': ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android'],
            'database': ['postgresql', 'mongodb', 'mysql', 'redis', 'elasticsearch', 'dynamodb'],
            'devops': ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'terraform'],
            'ai_ml': ['machine learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'deep learning'],
            'blockchain': ['ethereum', 'solidity', 'web3', 'smart contracts', 'blockchain'],
            'specialized': ['embedded systems', 'iot', 'ar/vr', 'game development', 'graphics']
        }
    
    def _initialize_tech_complexity(self) -> Dict[str, float]:
        """Initialize technology complexity multipliers"""
        return {
            'ai_ml': 1.5,
            'blockchain': 1.4,
            'specialized': 1.3,
            'mobile': 1.2,
            'devops': 1.15,
            'backend': 1.0,
            'frontend': 0.9,
            'database': 1.0
        }
    
    def extract_features(self, projects_df: pd.DataFrame, fit: bool = False) -> np.ndarray:
        """
        Extract all features from project dataframe
        
        Args:
            projects_df: DataFrame with project data
            fit: Whether to fit transformers on this data
            
        Returns:
            Feature matrix as numpy array
        """
        features = []
        
        # Text features from descriptions
        text_features = self._extract_text_features(projects_df['description'], fit)
        features.append(text_features)
        
        # Skill-based features
        skill_features = self._extract_skill_features(projects_df['required_skills'])
        features.append(skill_features)
        
        # Complexity features
        complexity_features = self._extract_complexity_features(projects_df)
        features.append(complexity_features)
        
        # Temporal features
        temporal_features = self._extract_temporal_features(projects_df)
        features.append(temporal_features)
        
        # Market features
        market_features = self._extract_market_features(projects_df)
        features.append(market_features)
        
        # Combine all features
        combined_features = np.hstack(features)
        
        # Scale numerical features
        if fit:
            combined_features = self.scaler.fit_transform(combined_features)
        else:
            combined_features = self.scaler.transform(combined_features)
        
        return combined_features
    
    def _extract_text_features(self, descriptions: pd.Series, fit: bool) -> np.ndarray:
        """Extract TF-IDF features from project descriptions"""
        # Clean descriptions
        descriptions = descriptions.fillna('').astype(str)
        
        if fit:
            return self.description_vectorizer.fit_transform(descriptions).toarray()
        else:
            return self.description_vectorizer.transform(descriptions).toarray()
    
    def _extract_skill_features(self, skills: pd.Series) -> np.ndarray:
        """Extract features from required skills"""
        features = []
        
        for skill_list in skills:
            if isinstance(skill_list, str):
                skill_list = json.loads(skill_list)
            if not isinstance(skill_list, list):
                skill_list = []
            
            # Normalize skills to lowercase
            skills_lower = [s.lower().strip() for s in skill_list]
            
            # Count total skills
            num_skills = len(skills_lower)
            
            # Count skills by category
            category_counts = {}
            for category, category_skills in self.skill_categories.items():
                count = sum(1 for skill in skills_lower 
                           if any(cs in skill for cs in category_skills))
                category_counts[category] = count
            
            # Calculate tech stack diversity (entropy)
            total_categorized = sum(category_counts.values())
            if total_categorized > 0:
                category_probs = [c / total_categorized for c in category_counts.values() if c > 0]
                diversity = -sum(p * np.log(p) for p in category_probs)
            else:
                diversity = 0
            
            # Calculate complexity multiplier
            complexity_multiplier = 1.0
            for category, count in category_counts.items():
                if count > 0:
                    complexity_multiplier *= self.tech_stack_complexity.get(category, 1.0)
            
            # Build feature vector
            feature_vector = [
                num_skills,
                diversity,
                complexity_multiplier,
                *category_counts.values()
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def _extract_complexity_features(self, projects_df: pd.DataFrame) -> np.ndarray:
        """Extract project complexity indicators"""
        features = []
        
        for _, project in projects_df.iterrows():
            # Estimated hours
            estimated_hours = project.get('estimated_hours', 0) or 0
            
            # Duration in weeks
            duration_weeks = project.get('estimated_duration_weeks', 0) or 0
            
            # Complexity level encoding
            complexity_map = {'low': 1, 'medium': 2, 'high': 3, 'expert': 4}
            complexity_score = complexity_map.get(
                str(project.get('complexity_level', 'medium')).lower(), 2
            )
            
            # Calculate features from project description
            description = str(project.get('description', ''))
            description_length = len(description)
            word_count = len(description.split())
            
            # Feature extraction patterns
            has_api_integration = int('api' in description.lower())
            has_database = int(any(db in description.lower() 
                                  for db in ['database', 'db', 'sql', 'nosql']))
            has_authentication = int(any(auth in description.lower() 
                                        for auth in ['auth', 'login', 'oauth', 'jwt']))
            has_payment = int(any(pay in description.lower() 
                                 for pay in ['payment', 'stripe', 'paypal', 'checkout']))
            has_realtime = int(any(rt in description.lower() 
                                  for rt in ['realtime', 'websocket', 'live']))
            has_mobile = int(any(mobile in description.lower() 
                                for mobile in ['mobile', 'ios', 'android', 'app']))
            
            # Budget range if provided
            budget_min = project.get('initial_budget_min', 0) or 0
            budget_max = project.get('initial_budget_max', 0) or 0
            budget_range_size = budget_max - budget_min if budget_max > budget_min else 0
            
            feature_vector = [
                estimated_hours,
                duration_weeks,
                complexity_score,
                description_length,
                word_count,
                has_api_integration,
                has_database,
                has_authentication,
                has_payment,
                has_realtime,
                has_mobile,
                budget_min,
                budget_max,
                budget_range_size
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def _extract_temporal_features(self, projects_df: pd.DataFrame) -> np.ndarray:
        """Extract temporal features"""
        features = []
        
        for _, project in projects_df.iterrows():
            created_at = pd.to_datetime(project.get('created_at', pd.Timestamp.now()))
            
            # Extract temporal components
            month = created_at.month
            quarter = (month - 1) // 3 + 1
            day_of_week = created_at.dayofweek
            
            # Cyclical encoding for month and day of week
            month_sin = np.sin(2 * np.pi * month / 12)
            month_cos = np.cos(2 * np.pi * month / 12)
            dow_sin = np.sin(2 * np.pi * day_of_week / 7)
            dow_cos = np.cos(2 * np.pi * day_of_week / 7)
            
            feature_vector = [
                quarter,
                month_sin,
                month_cos,
                dow_sin,
                dow_cos
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def _extract_market_features(self, projects_df: pd.DataFrame) -> np.ndarray:
        """Extract market and regional features"""
        features = []
        
        for _, project in projects_df.iterrows():
            # Region encoding
            region = project.get('region', 'Global')
            
            # Regional cost multipliers (based on typical market rates)
            region_multipliers = {
                'North America': 1.3,
                'Western Europe': 1.2,
                'Eastern Europe': 0.7,
                'Asia Pacific': 0.8,
                'Latin America': 0.6,
                'Middle East': 0.9,
                'Africa': 0.5,
                'Global': 1.0
            }
            
            region_multiplier = region_multipliers.get(region, 1.0)
            
            # Currency encoding (1 for USD, adjust for others)
            currency = project.get('currency', 'USD')
            is_usd = 1 if currency == 'USD' else 0
            
            # Project type one-hot encoding (top categories)
            project_type = str(project.get('project_type', 'other')).lower()
            is_web_app = 1 if 'web' in project_type else 0
            is_mobile_app = 1 if 'mobile' in project_type else 0
            is_api = 1 if 'api' in project_type else 0
            is_ecommerce = 1 if 'ecommerce' in project_type or 'e-commerce' in project_type else 0
            is_data = 1 if 'data' in project_type or 'analytics' in project_type else 0
            
            feature_vector = [
                region_multiplier,
                is_usd,
                is_web_app,
                is_mobile_app,
                is_api,
                is_ecommerce,
                is_data
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def extract_single_project_features(self, project_data: Dict[str, Any]) -> np.ndarray:
        """Extract features for a single project (for prediction)"""
        # Convert to DataFrame with single row
        df = pd.DataFrame([project_data])
        
        # Extract features
        features = self.extract_features(df, fit=False)
        
        return features[0]
    
    def get_feature_names(self) -> List[str]:
        """Get names of all features"""
        feature_names = []
        
        # Text features
        if hasattr(self.description_vectorizer, 'get_feature_names_out'):
            feature_names.extend([f'text_{name}' for name in 
                                self.description_vectorizer.get_feature_names_out()])
        
        # Skill features
        feature_names.extend([
            'num_skills',
            'tech_stack_diversity',
            'complexity_multiplier',
            *[f'skill_category_{cat}' for cat in self.skill_categories.keys()]
        ])
        
        # Complexity features
        feature_names.extend([
            'estimated_hours',
            'duration_weeks',
            'complexity_score',
            'description_length',
            'word_count',
            'has_api_integration',
            'has_database',
            'has_authentication',
            'has_payment',
            'has_realtime',
            'has_mobile',
            'budget_min',
            'budget_max',
            'budget_range_size'
        ])
        
        # Temporal features
        feature_names.extend([
            'quarter',
            'month_sin',
            'month_cos',
            'dow_sin',
            'dow_cos'
        ])
        
        # Market features
        feature_names.extend([
            'region_multiplier',
            'is_usd',
            'is_web_app',
            'is_mobile_app',
            'is_api',
            'is_ecommerce',
            'is_data'
        ])
        
        return feature_names


class MarketRateCalculator:
    """Calculate market rates and premiums for skills"""
    
    def __init__(self):
        self.base_rates = self._initialize_base_rates()
        self.regional_adjustments = self._initialize_regional_adjustments()
    
    def _initialize_base_rates(self) -> Dict[str, float]:
        """Initialize base hourly rates for skill categories"""
        return {
            'ai_ml': 120.0,
            'blockchain': 110.0,
            'specialized': 100.0,
            'mobile': 85.0,
            'devops': 90.0,
            'backend': 80.0,
            'frontend': 70.0,
            'database': 75.0
        }
    
    def _initialize_regional_adjustments(self) -> Dict[str, float]:
        """Initialize regional cost adjustments"""
        return {
            'North America': 1.3,
            'Western Europe': 1.2,
            'Eastern Europe': 0.7,
            'Asia Pacific': 0.8,
            'Latin America': 0.6,
            'Middle East': 0.9,
            'Africa': 0.5,
            'Global': 1.0
        }
    
    def calculate_skill_premium(self, skills: List[str], region: str = 'Global') -> Dict[str, float]:
        """Calculate premium factors for given skills"""
        skill_premiums = {}
        
        skills_lower = [s.lower().strip() for s in skills]
        regional_adjustment = self.regional_adjustments.get(region, 1.0)
        
        # Categorize skills
        skill_categories = ProjectFeatureExtractor()._initialize_skill_categories()
        
        for skill in skills_lower:
            # Find category
            category = 'frontend'  # default
            for cat, cat_skills in skill_categories.items():
                if any(cs in skill for cs in cat_skills):
                    category = cat
                    break
            
            # Get base rate and apply regional adjustment
            base_rate = self.base_rates.get(category, 75.0)
            adjusted_rate = base_rate * regional_adjustment
            
            skill_premiums[skill] = adjusted_rate
        
        return skill_premiums
    
    def estimate_project_rate_range(
        self, 
        skills: List[str], 
        hours: int, 
        region: str = 'Global'
    ) -> Tuple[float, float]:
        """Estimate budget range based on skills and hours"""
        if not skills or hours <= 0:
            return (0, 0)
        
        skill_premiums = self.calculate_skill_premium(skills, region)
        
        # Calculate weighted average rate
        avg_rate = np.mean(list(skill_premiums.values()))
        
        # Apply demand multiplier (simulated - in production, fetch from DB)
        demand_multiplier = 1.0
        
        # Calculate range (±20% for variance)
        min_budget = hours * avg_rate * 0.8 * demand_multiplier
        max_budget = hours * avg_rate * 1.2 * demand_multiplier
        
        return (min_budget, max_budget)
