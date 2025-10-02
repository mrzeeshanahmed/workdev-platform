#!/usr/bin/env python3
"""
Database Seed Script - Market Rates and Historical Projects
Populates initial data for Budget Estimation system
"""

import os
import sys
import json
from datetime import datetime, timedelta
import random
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Market rate data for common skills
MARKET_RATES = [
    {
        'skill_name': 'React',
        'skill_category': 'frontend',
        'base_hourly_rate': 70.00,
        'regional_rates': {
            'North America': 91.00,
            'Europe': 77.00,
            'Asia Pacific': 63.00,
            'Latin America': 56.00,
            'Middle East': 70.00
        },
        'demand_factor': 1.10,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Vue.js',
        'skill_category': 'frontend',
        'base_hourly_rate': 68.00,
        'regional_rates': {
            'North America': 88.40,
            'Europe': 74.80,
            'Asia Pacific': 61.20,
            'Latin America': 54.40,
            'Middle East': 68.00
        },
        'demand_factor': 1.08,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Angular',
        'skill_category': 'frontend',
        'base_hourly_rate': 72.00,
        'regional_rates': {
            'North America': 93.60,
            'Europe': 79.20,
            'Asia Pacific': 64.80,
            'Latin America': 57.60,
            'Middle East': 72.00
        },
        'demand_factor': 1.05,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'TypeScript',
        'skill_category': 'frontend',
        'base_hourly_rate': 75.00,
        'regional_rates': {
            'North America': 97.50,
            'Europe': 82.50,
            'Asia Pacific': 67.50,
            'Latin America': 60.00,
            'Middle East': 75.00
        },
        'demand_factor': 1.08,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Node.js',
        'skill_category': 'backend',
        'base_hourly_rate': 80.00,
        'regional_rates': {
            'North America': 104.00,
            'Europe': 88.00,
            'Asia Pacific': 72.00,
            'Latin America': 64.00,
            'Middle East': 80.00
        },
        'demand_factor': 1.15,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Python',
        'skill_category': 'backend',
        'base_hourly_rate': 80.00,
        'regional_rates': {
            'North America': 104.00,
            'Europe': 88.00,
            'Asia Pacific': 72.00,
            'Latin America': 64.00,
            'Middle East': 80.00
        },
        'demand_factor': 1.12,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Java',
        'skill_category': 'backend',
        'base_hourly_rate': 85.00,
        'regional_rates': {
            'North America': 110.50,
            'Europe': 93.50,
            'Asia Pacific': 76.50,
            'Latin America': 68.00,
            'Middle East': 85.00
        },
        'demand_factor': 1.10,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Go',
        'skill_category': 'backend',
        'base_hourly_rate': 90.00,
        'regional_rates': {
            'North America': 117.00,
            'Europe': 99.00,
            'Asia Pacific': 81.00,
            'Latin America': 72.00,
            'Middle East': 90.00
        },
        'demand_factor': 1.18,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'PostgreSQL',
        'skill_category': 'database',
        'base_hourly_rate': 75.00,
        'regional_rates': {
            'North America': 97.50,
            'Europe': 82.50,
            'Asia Pacific': 67.50,
            'Latin America': 60.00,
            'Middle East': 75.00
        },
        'demand_factor': 1.05,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'MongoDB',
        'skill_category': 'database',
        'base_hourly_rate': 72.00,
        'regional_rates': {
            'North America': 93.60,
            'Europe': 79.20,
            'Asia Pacific': 64.80,
            'Latin America': 57.60,
            'Middle East': 72.00
        },
        'demand_factor': 1.08,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Redis',
        'skill_category': 'database',
        'base_hourly_rate': 70.00,
        'regional_rates': {
            'North America': 91.00,
            'Europe': 77.00,
            'Asia Pacific': 63.00,
            'Latin America': 56.00,
            'Middle East': 70.00
        },
        'demand_factor': 1.06,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'AWS',
        'skill_category': 'devops',
        'base_hourly_rate': 90.00,
        'regional_rates': {
            'North America': 117.00,
            'Europe': 99.00,
            'Asia Pacific': 81.00,
            'Latin America': 72.00,
            'Middle East': 90.00
        },
        'demand_factor': 1.20,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Docker',
        'skill_category': 'devops',
        'base_hourly_rate': 85.00,
        'regional_rates': {
            'North America': 110.50,
            'Europe': 93.50,
            'Asia Pacific': 76.50,
            'Latin America': 68.00,
            'Middle East': 85.00
        },
        'demand_factor': 1.10,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Kubernetes',
        'skill_category': 'devops',
        'base_hourly_rate': 95.00,
        'regional_rates': {
            'North America': 123.50,
            'Europe': 104.50,
            'Asia Pacific': 85.50,
            'Latin America': 76.00,
            'Middle East': 95.00
        },
        'demand_factor': 1.25,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'TensorFlow',
        'skill_category': 'ai_ml',
        'base_hourly_rate': 120.00,
        'regional_rates': {
            'North America': 156.00,
            'Europe': 132.00,
            'Asia Pacific': 108.00,
            'Latin America': 96.00,
            'Middle East': 120.00
        },
        'demand_factor': 1.30,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'PyTorch',
        'skill_category': 'ai_ml',
        'base_hourly_rate': 125.00,
        'regional_rates': {
            'North America': 162.50,
            'Europe': 137.50,
            'Asia Pacific': 112.50,
            'Latin America': 100.00,
            'Middle East': 125.00
        },
        'demand_factor': 1.32,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Solidity',
        'skill_category': 'blockchain',
        'base_hourly_rate': 110.00,
        'regional_rates': {
            'North America': 143.00,
            'Europe': 121.00,
            'Asia Pacific': 99.00,
            'Latin America': 88.00,
            'Middle East': 110.00
        },
        'demand_factor': 1.25,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Rust',
        'skill_category': 'blockchain',
        'base_hourly_rate': 105.00,
        'regional_rates': {
            'North America': 136.50,
            'Europe': 115.50,
            'Asia Pacific': 94.50,
            'Latin America': 84.00,
            'Middle East': 105.00
        },
        'demand_factor': 1.22,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'React Native',
        'skill_category': 'mobile',
        'base_hourly_rate': 85.00,
        'regional_rates': {
            'North America': 110.50,
            'Europe': 93.50,
            'Asia Pacific': 76.50,
            'Latin America': 68.00,
            'Middle East': 85.00
        },
        'demand_factor': 1.15,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Swift',
        'skill_category': 'mobile',
        'base_hourly_rate': 88.00,
        'regional_rates': {
            'North America': 114.40,
            'Europe': 96.80,
            'Asia Pacific': 79.20,
            'Latin America': 70.40,
            'Middle East': 88.00
        },
        'demand_factor': 1.12,
        'data_source': 'market_survey_2025'
    },
    {
        'skill_name': 'Flutter',
        'skill_category': 'mobile',
        'base_hourly_rate': 82.00,
        'regional_rates': {
            'North America': 106.60,
            'Europe': 90.20,
            'Asia Pacific': 73.80,
            'Latin America': 65.60,
            'Middle East': 82.00
        },
        'demand_factor': 1.14,
        'data_source': 'market_survey_2025'
    }
]

# Sample project templates for generating historical data
PROJECT_TEMPLATES = [
    {
        'type': 'web_app',
        'complexity': 'low',
        'hours_range': (100, 200),
        'skills': ['React', 'Node.js', 'PostgreSQL'],
        'descriptions': [
            'Build a simple task management web application',
            'Create a blog platform with user authentication',
            'Develop a portfolio website with CMS'
        ]
    },
    {
        'type': 'web_app',
        'complexity': 'medium',
        'hours_range': (300, 500),
        'skills': ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
        'descriptions': [
            'Build an e-commerce platform with payment integration',
            'Create a social media application with real-time features',
            'Develop a project management system with collaboration tools'
        ]
    },
    {
        'type': 'web_app',
        'complexity': 'high',
        'hours_range': (600, 1000),
        'skills': ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'Kubernetes'],
        'descriptions': [
            'Build a SaaS platform with multi-tenancy and billing',
            'Create an enterprise CRM system with advanced analytics',
            'Develop a financial trading platform with real-time data'
        ]
    },
    {
        'type': 'mobile_app',
        'complexity': 'medium',
        'hours_range': (250, 400),
        'skills': ['React Native', 'Node.js', 'MongoDB'],
        'descriptions': [
            'Build a fitness tracking mobile application',
            'Create a food delivery app with real-time tracking',
            'Develop a social networking mobile app'
        ]
    },
    {
        'type': 'api_backend',
        'complexity': 'medium',
        'hours_range': (200, 350),
        'skills': ['Python', 'PostgreSQL', 'Docker', 'AWS'],
        'descriptions': [
            'Build a RESTful API for content management',
            'Create a microservices backend for e-commerce',
            'Develop an API gateway with authentication'
        ]
    },
    {
        'type': 'ml_model',
        'complexity': 'high',
        'hours_range': (400, 700),
        'skills': ['Python', 'TensorFlow', 'PostgreSQL', 'Docker', 'AWS'],
        'descriptions': [
            'Build a recommendation system using machine learning',
            'Create a computer vision model for image classification',
            'Develop a natural language processing pipeline'
        ]
    },
    {
        'type': 'blockchain',
        'complexity': 'high',
        'hours_range': (500, 900),
        'skills': ['Solidity', 'React', 'Node.js', 'Web3'],
        'descriptions': [
            'Build a decentralized finance (DeFi) application',
            'Create an NFT marketplace with smart contracts',
            'Develop a blockchain-based supply chain system'
        ]
    }
]

REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Global']

def seed_market_rates(conn):
    """Insert market rate data"""
    print("\nSeeding market rate data...")
    cursor = conn.cursor()
    
    for rate in MARKET_RATES:
        try:
            cursor.execute("""
                INSERT INTO market_rate_data (
                    skill_name,
                    skill_category,
                    base_hourly_rate,
                    regional_rates,
                    demand_factor,
                    data_source,
                    last_updated
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (skill_name) DO UPDATE SET
                    base_hourly_rate = EXCLUDED.base_hourly_rate,
                    regional_rates = EXCLUDED.regional_rates,
                    demand_factor = EXCLUDED.demand_factor,
                    last_updated = EXCLUDED.last_updated
            """, (
                rate['skill_name'],
                rate['skill_category'],
                rate['base_hourly_rate'],
                json.dumps(rate['regional_rates']),
                rate['demand_factor'],
                rate['data_source'],
                datetime.now()
            ))
            print(f"  ✓ {rate['skill_name']} - ${rate['base_hourly_rate']}/hr")
        except Exception as e:
            print(f"  ✗ {rate['skill_name']} - Error: {e}")
    
    conn.commit()
    print(f"✓ Seeded {len(MARKET_RATES)} market rates")

def generate_historical_projects(conn, count=150):
    """Generate synthetic historical project data"""
    print(f"\nGenerating {count} historical projects...")
    cursor = conn.cursor()
    
    inserted = 0
    for i in range(count):
        # Pick random template
        template = random.choice(PROJECT_TEMPLATES)
        
        # Generate project details
        description = random.choice(template['descriptions'])
        skills = template['skills'].copy()
        
        # Add some random additional skills (20% chance)
        if random.random() < 0.2:
            extra_skills = random.sample([r['skill_name'] for r in MARKET_RATES if r['skill_name'] not in skills], k=min(2, len(MARKET_RATES)))
            skills.extend(extra_skills)
        
        estimated_hours = random.randint(*template['hours_range'])
        
        # Actual hours vary -20% to +40% from estimate
        variance = random.uniform(0.8, 1.4)
        actual_hours = int(estimated_hours * variance)
        
        # Calculate budget based on skills and region
        region = random.choice(REGIONS)
        skill_rates = [r for r in MARKET_RATES if r['skill_name'] in skills]
        
        if region == 'Global':
            avg_rate = sum(r['base_hourly_rate'] for r in skill_rates) / len(skill_rates)
        else:
            avg_rate = sum(r['regional_rates'].get(region, r['base_hourly_rate']) for r in skill_rates) / len(skill_rates)
        
        # Add complexity multiplier
        complexity_multipliers = {'low': 0.9, 'medium': 1.0, 'high': 1.15}
        avg_rate *= complexity_multipliers[template['complexity']]
        
        final_budget = actual_hours * avg_rate
        
        # Completion date between 6 months and 2 years ago
        days_ago = random.randint(180, 730)
        completion_date = datetime.now() - timedelta(days=days_ago)
        
        # Tech stack
        tech_stack = {
            'languages': random.sample(['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust'], k=random.randint(1, 3)),
            'frameworks': random.sample(['React', 'Vue', 'Angular', 'Node.js', 'Django', 'Flask'], k=random.randint(1, 2)),
            'databases': random.sample(['PostgreSQL', 'MongoDB', 'Redis', 'MySQL'], k=random.randint(1, 2))
        }
        
        try:
            cursor.execute("""
                INSERT INTO historical_project_budgets (
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                description,
                skills,
                estimated_hours,
                actual_hours,
                round(final_budget, 2),
                template['complexity'],
                template['type'],
                region,
                json.dumps(tech_stack),
                completion_date
            ))
            inserted += 1
            
            if (i + 1) % 25 == 0:
                print(f"  Progress: {i + 1}/{count} projects generated")
        
        except Exception as e:
            print(f"  ✗ Error generating project {i+1}: {e}")
    
    conn.commit()
    print(f"✓ Generated {inserted} historical projects")

def main():
    print("=" * 80)
    print("Budget Estimation System - Database Seed Script")
    print("=" * 80)
    
    # Database connection
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("\nERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    print(f"\nConnecting to database...")
    try:
        conn = psycopg2.connect(db_url)
        print("✓ Connected successfully")
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        sys.exit(1)
    
    # Seed data
    seed_market_rates(conn)
    generate_historical_projects(conn, count=150)
    
    # Summary
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM market_rate_data")
    rates_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM historical_project_budgets")
    projects_count = cursor.fetchone()[0]
    
    cursor.close()
    conn.close()
    
    print()
    print("=" * 80)
    print("SEED COMPLETED SUCCESSFULLY")
    print("=" * 80)
    print(f"Market Rates:         {rates_count} skills")
    print(f"Historical Projects:  {projects_count} projects")
    print()
    print("Next step: Train the initial model with:")
    print("  python train_initial_model.py")
    print()

if __name__ == '__main__':
    main()
