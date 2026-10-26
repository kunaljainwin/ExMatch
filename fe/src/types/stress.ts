export interface StressTestConfig {
  targetRateOpsPerSec: number; // e.g. 1000, 5000, 20000, 50000
  ratioLimitOrders: number;    // percentage of limit orders (e.g. 0.6)
  ratioMarketOrders: number;   // percentage of market orders (e.g. 0.2)
  ratioCancels: number;        // percentage of cancel orders (e.g. 0.2)
  tickSpreadRange: number;     // ticks around mid
  batchSize: number;
  durationSeconds: number;
}

export interface LatencyHistogram {
  minUs: number;
  p50Us: number;
  p90Us: number;
  p99Us: number;
  p999Us: number;
  maxUs: number;
  sampleCount: number;
}

export interface StressMetrics {
  isRunning: boolean;
  elapsedMs: number;
  totalOrdersProcessed: number;
  totalTradesMatched: number;
  totalCancelsProcessed: number;
  currentThroughputOpsPerSec: number;
  peakThroughputOpsPerSec: number;
  latencyHistogram: LatencyHistogram;
  ringBufferUsagePercent: number; // Simulates ExMatch SPSC ring buffer depth
  memoryFootprintKb: number;
}
