'use strict';

const model = require('../../model/user_state_kmeans_window.inference.json');

function fillMissing(features) {
  return model.feature_columns.map((col, i) => {
    const v = features[col];

    if (v === null || v === undefined || Number.isNaN(Number(v))) {
      return model.imputer_statistics[i];
    }

    return Number(v);
  });
}

function scaleVector(xs) {
  return xs.map((x, i) => {
    const scale = model.scaler_scale[i] || 1;
    return (x - model.scaler_mean[i]) / scale;
  });
}

function squaredDistance(a, b) {
  return a.reduce((sum, x, i) => {
    const d = x - b[i];
    return sum + d * d;
  }, 0);
}

function predictUserState(features) {
  const filled = fillMissing(features);
  const scaled = scaleVector(filled);

  let bestCluster = 0;
  let bestDistance = Infinity;

  model.cluster_centers.forEach((center, clusterId) => {
    const dist = squaredDistance(scaled, center);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestCluster = clusterId;
    }
  });

  const info = model.cluster_interpretations[String(bestCluster)] || {};

  return {
    model_name: model.model_name,
    model_version: model.model_version,
    window_days: model.window_days,
    cluster_id: bestCluster,
    cluster_name: info.cluster_name || `Cluster ${bestCluster}`,
    description: info.description || '',
    recommendations: info.recommendations || [],
    distance: Number(bestDistance.toFixed(6)),
    input_features: features,
  };
}

module.exports = {
  predictUserState,
};