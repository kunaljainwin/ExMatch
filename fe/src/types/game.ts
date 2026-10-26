export type MarketMakerMode = 'SCALPER' | 'FLASH_CRASH' | 'BOT_ARENA';

export interface PlayerInventory {
  position: number;        // Current units held (+ for long, - for short)
  cash: number;            // Current cash balance
  realizedPnl: number;     // Realized profit/loss
  unrealizedPnl: number;   // Floating profit/loss based on mid price
  totalPnl: number;        // realized + unrealized
  volumeTraded: number;    // Cumulative volume
  totalTrades: number;     // Trade count
  winningTrades: number;   // Profitable trades
  maxDrawdown: number;     // Maximum peak-to-trough drop in total PnL
  peakPnl: number;
  averageEntryPrice: number;
  sharpeRatio: number;
}

export interface AvellanedaParams {
  riskAversion: number;   // Gamma (γ), typical: 0.1 - 0.5
  volatility: number;     // Sigma (σ), tick volatility
  timeHorizon: number;    // T - t, trading session horizon
  orderIntensity: number; // Kappa (κ), liquidity parameter
}

export interface AvellanedaOutput {
  reservationPrice: number; // r(s, q, t)
  optimalBid: number;       // r - delta_b
  optimalAsk: number;       // r + delta_a
  halfSpread: number;       // delta
  skewTicks: number;        // How many ticks to skew bids vs asks
}

export interface BotArenaConfig {
  enabled: boolean;
  spreadTicks: number;       // Quote spread around mid
  orderSize: number;         // Quote lot size
  maxInventory: number;      // Max allowed position
  inventorySkewFactor: number;// Price shift per unit of inventory
  quoteRefreshIntervalMs: number;
  useAvellanedaModel: boolean;
}

export interface GameAchievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}
