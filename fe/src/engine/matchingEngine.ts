import { Order, OrderBookSnapshot, PriceLevel, Side, Trade, WALEvent } from '../types/engine';

export class MatchingEngine {
  private sequenceId = 0;
  private orders = new Map<string, Order>();
  private bids = new Map<number, Order[]>(); // Price -> queue of buy orders
  private asks = new Map<number, Order[]>(); // Price -> queue of sell orders
  private lastTradePrice: number | null = 100.0;
  private wal: WALEvent[] = [];
  private readonly maxWalEntries = 200;
  private tickSize = 0.05;

  constructor(initialPrice = 100.0, tickSize = 0.05) {
    this.lastTradePrice = initialPrice;
    this.tickSize = tickSize;
  }

  public roundPrice(price: number): number {
    return Number((Math.round(price / this.tickSize) * this.tickSize).toFixed(4));
  }

  public getSequenceId(): number {
    return this.sequenceId;
  }

  public getWAL(): WALEvent[] {
    return this.wal;
  }

  private appendWAL(event: Omit<WALEvent, 'sequenceId' | 'timestamp'>) {
    this.sequenceId++;
    const walEvent: WALEvent = {
      ...event,
      sequenceId: this.sequenceId,
      timestamp: performance.now() * 1000,
    };
    this.wal.push(walEvent);
    if (this.wal.length > this.maxWalEntries) {
      this.wal.shift();
    }
  }

  public submitOrder(orderInput: Omit<Order, 'id' | 'filledQuantity' | 'status' | 'timestamp'>): {
    order: Order;
    trades: Trade[];
    rejected: boolean;
    rejectReason?: string;
  } {
    const price = this.roundPrice(orderInput.price);
    const order: Order = {
      ...orderInput,
      id: 'ord_' + Math.random().toString(36).substring(2, 9),
      price,
      filledQuantity: 0,
      status: 'NEW',
      timestamp: performance.now() * 1000,
    };

    // Post-Only check: if order would cross book immediately, reject it
    if (order.type === 'POST_ONLY') {
      if (order.side === 'BUY') {
        const bestAsk = this.getBestAsk();
        if (bestAsk !== null && order.price >= bestAsk) {
          this.appendWAL({
            type: 'REJECT',
            orderId: order.id,
            side: order.side,
            price: order.price,
            quantity: order.quantity,
            detail: 'POST_ONLY rejected: would execute immediately as taker',
          });
          return { order, trades: [], rejected: true, rejectReason: 'Post-only crosses spread' };
        }
      } else {
        const bestBid = this.getBestBid();
        if (bestBid !== null && order.price <= bestBid) {
          this.appendWAL({
            type: 'REJECT',
            orderId: order.id,
            side: order.side,
            price: order.price,
            quantity: order.quantity,
            detail: 'POST_ONLY rejected: would execute immediately as taker',
          });
          return { order, trades: [], rejected: true, rejectReason: 'Post-only crosses spread' };
        }
      }
    }

    // FOK check: must be able to fill entirely immediately, else reject
    if (order.type === 'FOK') {
      const availableLiquidity = this.calculateLiquidity(order.side === 'BUY' ? 'SELL' : 'BUY', order.price);
      if (availableLiquidity < order.quantity) {
        this.appendWAL({
          type: 'REJECT',
          orderId: order.id,
          side: order.side,
          price: order.price,
          quantity: order.quantity,
          detail: 'FOK rejected: insufficient liquidity to fill entire quantity',
        });
        return { order, trades: [], rejected: true, rejectReason: 'FOK insufficient liquidity' };
      }
    }

    this.orders.set(order.id, order);
    this.appendWAL({
      type: 'NEW_ORDER',
      orderId: order.id,
      side: order.side,
      price: order.price,
      quantity: order.quantity,
      detail: `${order.owner} placed ${order.type} ${order.side} ${order.quantity}@${order.price.toFixed(2)}`,
    });

    const trades = this.match(order);

    // IOC handling: cancel any remaining unexecuted quantity
    if (order.type === 'IOC' && order.filledQuantity < order.quantity) {
      order.status = order.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'CANCELLED';
      this.orders.delete(order.id);
      this.appendWAL({
        type: 'CANCEL_ORDER',
        orderId: order.id,
        side: order.side,
        price: order.price,
        detail: `IOC unfilled balance (${order.quantity - order.filledQuantity}) automatically cancelled`,
      });
    } else if (order.filledQuantity < order.quantity && order.type !== 'MARKET') {
      // Place remaining on book
      this.insertToBook(order);
    } else if (order.filledQuantity >= order.quantity) {
      order.status = 'FILLED';
    }

    return { order, trades, rejected: false };
  }

  public cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'FILLED' || order.status === 'CANCELLED') {
      return false;
    }

    this.removeFromBook(order);
    order.status = 'CANCELLED';
    this.orders.delete(orderId);

    this.appendWAL({
      type: 'CANCEL_ORDER',
      orderId,
      side: order.side,
      price: order.price,
      detail: `${order.owner} cancelled ${order.side} ${order.quantity}@${order.price.toFixed(2)}`,
    });

    return true;
  }

  public cancelAllForOwner(owner: Order['owner']): number {
    let count = 0;
    for (const [id, order] of Array.from(this.orders.entries())) {
      if (order.owner === owner) {
        if (this.cancelOrder(id)) count++;
      }
    }
    return count;
  }

  private match(taker: Order): Trade[] {
    const trades: Trade[] = [];

    if (taker.side === 'BUY') {
      // Match against asks sorted ascending
      const sortedAskPrices = Array.from(this.asks.keys()).sort((a, b) => a - b);
      for (const price of sortedAskPrices) {
        if (taker.type !== 'MARKET' && price > taker.price) break;
        if (taker.filledQuantity >= taker.quantity) break;

        const queue = this.asks.get(price)!;
        while (queue.length > 0 && taker.filledQuantity < taker.quantity) {
          const maker = queue[0];
          const remainingTaker = taker.quantity - taker.filledQuantity;
          const remainingMaker = maker.quantity - maker.filledQuantity;
          const matchQty = Math.min(remainingTaker, remainingMaker);

          maker.filledQuantity += matchQty;
          taker.filledQuantity += matchQty;

          if (maker.filledQuantity >= maker.quantity) {
            maker.status = 'FILLED';
            queue.shift();
            this.orders.delete(maker.id);
          } else {
            maker.status = 'PARTIALLY_FILLED';
          }

          const trade: Trade = {
            id: 'trd_' + Math.random().toString(36).substring(2, 9),
            sequenceId: ++this.sequenceId,
            makerOrderId: maker.id,
            takerOrderId: taker.id,
            side: taker.side,
            price: maker.price,
            quantity: matchQty,
            timestamp: performance.now() * 1000,
            makerOwner: maker.owner,
            takerOwner: taker.owner,
          };

          this.lastTradePrice = trade.price;
          trades.push(trade);

          this.appendWAL({
            type: 'TRADE_EXEC',
            orderId: taker.id,
            side: taker.side,
            price: trade.price,
            quantity: matchQty,
            detail: `EXEC: ${taker.owner} matched with ${maker.owner} for ${matchQty}@${trade.price.toFixed(2)}`,
          });
        }

        if (queue.length === 0) {
          this.asks.delete(price);
        }
      }
    } else {
      // Match against bids sorted descending
      const sortedBidPrices = Array.from(this.bids.keys()).sort((a, b) => b - a);
      for (const price of sortedBidPrices) {
        if (taker.type !== 'MARKET' && price < taker.price) break;
        if (taker.filledQuantity >= taker.quantity) break;

        const queue = this.bids.get(price)!;
        while (queue.length > 0 && taker.filledQuantity < taker.quantity) {
          const maker = queue[0];
          const remainingTaker = taker.quantity - taker.filledQuantity;
          const remainingMaker = maker.quantity - maker.filledQuantity;
          const matchQty = Math.min(remainingTaker, remainingMaker);

          maker.filledQuantity += matchQty;
          taker.filledQuantity += matchQty;

          if (maker.filledQuantity >= maker.quantity) {
            maker.status = 'FILLED';
            queue.shift();
            this.orders.delete(maker.id);
          } else {
            maker.status = 'PARTIALLY_FILLED';
          }

          const trade: Trade = {
            id: 'trd_' + Math.random().toString(36).substring(2, 9),
            sequenceId: ++this.sequenceId,
            makerOrderId: maker.id,
            takerOrderId: taker.id,
            side: taker.side,
            price: maker.price,
            quantity: matchQty,
            timestamp: performance.now() * 1000,
            makerOwner: maker.owner,
            takerOwner: taker.owner,
          };

          this.lastTradePrice = trade.price;
          trades.push(trade);

          this.appendWAL({
            type: 'TRADE_EXEC',
            orderId: taker.id,
            side: taker.side,
            price: trade.price,
            quantity: matchQty,
            detail: `EXEC: ${taker.owner} matched with ${maker.owner} for ${matchQty}@${trade.price.toFixed(2)}`,
          });
        }

        if (queue.length === 0) {
          this.bids.delete(price);
        }
      }
    }

    if (taker.filledQuantity > 0 && taker.filledQuantity < taker.quantity) {
      taker.status = 'PARTIALLY_FILLED';
    }

    return trades;
  }

  private insertToBook(order: Order) {
    const book = order.side === 'BUY' ? this.bids : this.asks;
    if (!book.has(order.price)) {
      book.set(order.price, []);
    }
    book.get(order.price)!.push(order);
  }

  private removeFromBook(order: Order) {
    const book = order.side === 'BUY' ? this.bids : this.asks;
    const queue = book.get(order.price);
    if (!queue) return;
    const idx = queue.findIndex(o => o.id === order.id);
    if (idx !== -1) {
      queue.splice(idx, 1);
      if (queue.length === 0) {
        book.delete(order.price);
      }
    }
  }

  private calculateLiquidity(side: Side, limitPrice: number): number {
    const book = side === 'BUY' ? this.bids : this.asks;
    let total = 0;
    for (const [p, orders] of book.entries()) {
      if (side === 'BUY' && p >= limitPrice) {
        for (const o of orders) total += (o.quantity - o.filledQuantity);
      } else if (side === 'SELL' && p <= limitPrice) {
        for (const o of orders) total += (o.quantity - o.filledQuantity);
      }
    }
    return total;
  }

  public getBestBid(): number | null {
    if (this.bids.size === 0) return null;
    return Math.max(...Array.from(this.bids.keys()));
  }

  public getBestAsk(): number | null {
    if (this.asks.size === 0) return null;
    return Math.min(...Array.from(this.asks.keys()));
  }

  public getLastTradePrice(): number | null {
    return this.lastTradePrice;
  }

  public getSnapshot(depth = 12): OrderBookSnapshot {
    const sortedBids = Array.from(this.bids.keys())
      .sort((a, b) => b - a)
      .slice(0, depth)
      .map(price => {
        const orders = this.bids.get(price) || [];
        const totalQuantity = orders.reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0);
        const playerQuantity = orders.filter(o => o.owner === 'PLAYER').reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0);
        return { price, totalQuantity, orderCount: orders.length, playerQuantity };
      });

    const sortedAsks = Array.from(this.asks.keys())
      .sort((a, b) => a - b)
      .slice(0, depth)
      .map(price => {
        const orders = this.asks.get(price) || [];
        const totalQuantity = orders.reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0);
        const playerQuantity = orders.filter(o => o.owner === 'PLAYER').reduce((sum, o) => sum + (o.quantity - o.filledQuantity), 0);
        return { price, totalQuantity, orderCount: orders.length, playerQuantity };
      });

    const bestBid = sortedBids.length > 0 ? sortedBids[0].price : null;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0].price : null;
    const spread = (bestBid !== null && bestAsk !== null) ? Number((bestAsk - bestBid).toFixed(2)) : null;
    const midPrice = (bestBid !== null && bestAsk !== null) ? Number(((bestBid + bestAsk) / 2).toFixed(2)) : this.lastTradePrice;

    return {
      timestamp: performance.now(),
      sequenceId: this.sequenceId,
      bids: sortedBids,
      asks: sortedAsks,
      bestBid,
      bestAsk,
      spread,
      midPrice,
      lastTradePrice: this.lastTradePrice,
    };
  }

  public getOpenOrdersForOwner(owner: Order['owner']): Order[] {
    const list: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.owner === owner && order.status !== 'FILLED' && order.status !== 'CANCELLED') {
        list.push({ ...order });
      }
    }
    return list;
  }
}
