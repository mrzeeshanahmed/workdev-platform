/**
 * Statistical Analysis Utilities for A/B Testing
 */

import type { VariationResults, StatisticalAnalysis } from '../types';

/**
 * Calculate statistical significance using Z-test for proportions
 */
export function calculateStatisticalSignificance(
  controlConversions: number,
  controlSampleSize: number,
  treatmentConversions: number,
  treatmentSampleSize: number,
): StatisticalAnalysis {
  const controlRate = controlConversions / controlSampleSize;
  const treatmentRate = treatmentConversions / treatmentSampleSize;

  const pooledRate =
    (controlConversions + treatmentConversions) / (controlSampleSize + treatmentSampleSize);

  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / controlSampleSize + 1 / treatmentSampleSize),
  );

  const zScore = (treatmentRate - controlRate) / standardError;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  const effectSize = treatmentRate - controlRate;
  const requiredSampleSize = calculateRequiredSampleSize(controlRate, effectSize, 0.05, 0.8);

  return {
    p_value: pValue,
    confidence_level: (1 - pValue) * 100,
    sample_size: controlSampleSize + treatmentSampleSize,
    effect_size: effectSize,
    required_sample_size: requiredSampleSize,
    is_significant: pValue < 0.05,
  };
}

/**
 * Calculate required sample size for experiment
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8,
): number {
  const zAlpha = 1.96;
  const zBeta = 0.84;

  const p1 = baselineRate;
  const p2 = baselineRate + minimumDetectableEffect;

  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Calculate confidence interval for conversion rate
 */
export function calculateConfidenceInterval(
  conversions: number,
  sampleSize: number,
  confidenceLevel: number = 0.95,
): [number, number] {
  const rate = conversions / sampleSize;
  const zScore = 1.96;

  const standardError = Math.sqrt((rate * (1 - rate)) / sampleSize);
  const margin = zScore * standardError;

  return [Math.max(0, rate - margin), Math.min(1, rate + margin)];
}

/**
 * Determine if experiment should continue, stop, or rollout
 */
export function getExperimentRecommendation(
  currentSampleSize: number,
  requiredSampleSize: number,
  pValue: number,
  treatmentWinning: boolean,
): 'continue' | 'stop' | 'rollout' | 'rollback' {
  if (currentSampleSize < requiredSampleSize * 0.5) {
    return 'continue';
  }

  if (pValue < 0.05) {
    return treatmentWinning ? 'rollout' : 'rollback';
  }

  if (currentSampleSize >= requiredSampleSize) {
    return 'stop';
  }

  return 'continue';
}

/**
 * Normal cumulative distribution function (CDF)
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return x > 0 ? 1 - prob : prob;
}

/**
 * Format variation results for display
 */
export function formatVariationResults(variation: VariationResults, controlRate: number): string {
  const improvement = variation.improvement_over_control || 0;
  const significanceText = variation.statistical_significance
    ? `(p < ${variation.statistical_significance.toFixed(3)})`
    : '';

  return `${variation.name}: ${(variation.conversion_rate * 100).toFixed(2)}% conversion rate, ${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}% vs control ${significanceText}`;
}
