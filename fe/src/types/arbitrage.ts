export interface VenueQuote {
  venue: 'VENUE_A_PRIMARY' | 'EXMATCH_LOCAL';
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
  timestamp: number;
}

export interface ArbDislocation {
  id: string;
  type: 'BUY_LOCAL_SELL_PRIMARY' | 'BUY_PRIMARY_SELL_LOCAL';
  priceDislocation: number; // Spread profit per share
  availableVolume: number;
  localPrice: number;
  primaryPrice: number;
  discoveredAt: number;     // Microsecond timestamp
  expiresAt: number;        // When local market maker cancels stale order
  status: 'ACTIVE' | 'EXPIRED' | 'SNIPED' | 'MISSED_QUEUE';
}

export interface SnipingAttemptResult {
  success: boolean;
  dislocationId: string;
  playerLatencyUs: number;  // Simulated tick-to-trade latency
  queuePosition: number;    // Rank in matching engine queue
  profit: number;
  volume: number;
  reason?: 'TOO_SLOW_CANCELLED' | 'OUT_PRIORITIZED' | 'SLIPPAGE_REJECTED';
}

export interface ArbPlayerStats {
  score: number;
  totalAlphaCaptured: number;
  snipesAttempted: number;
  snipesSuccessful: number;
  winRate: number;
  avgLatencyUs: number;
  bestLatencyUs: number;
  streak: number;
}
