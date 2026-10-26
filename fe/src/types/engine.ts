export type Side = 'BUY' | 'SELL';

export type OrderType = 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY';

export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface Order {
  id: string;
  clientOrderId?: string;
  side: Side;
  price: number;
  quantity: number;
  filledQuantity: number;
  type: OrderType;
  status: OrderStatus;
  timestamp: number;
  owner: 'PLAYER' | 'BOT_NOISE' | 'BOT_ICEBERG' | 'BOT_INFORMED' | 'BOT_MM' | 'CHAOS_GENERATOR';
}

export interface Trade {
  id: string;
  sequenceId: number;
  makerOrderId: string;
  takerOrderId: string;
  side: Side;
  price: number;
  quantity: number;
  timestamp: number;
  makerOwner: string;
  takerOwner: string;
}

export interface PriceLevel {
  price: number;
  totalQuantity: number;
  orderCount: number;
  playerQuantity: number;
}

export interface OrderBookSnapshot {
  timestamp: number;
  sequenceId: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  midPrice: number | null;
  lastTradePrice: number | null;
}

export interface WALEvent {
  sequenceId: number;
  timestamp: number;
  type: 'NEW_ORDER' | 'CANCEL_ORDER' | 'TRADE_EXEC' | 'REJECT';
  orderId?: string;
  side?: Side;
  price?: number;
  quantity?: number;
  detail: string;
}
