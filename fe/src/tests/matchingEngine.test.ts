import { describe, expect, it } from 'vitest';
import { MatchingEngine } from '../engine/matchingEngine';

describe('MatchingEngine Core Tests', () => {
  it('should insert limit orders and match with price-time priority', () => {
    const engine = new MatchingEngine(100.0, 0.05);

    // Place resting ask
    const sellRes = engine.submitOrder({
      side: 'SELL',
      price: 100.10,
      quantity: 50,
      type: 'LIMIT',
      owner: 'PLAYER',
    });
    expect(sellRes.rejected).toBe(false);
    expect(sellRes.trades.length).toBe(0);

    // Place aggressive buy crossing the spread
    const buyRes = engine.submitOrder({
      side: 'BUY',
      price: 100.10,
      quantity: 30,
      type: 'LIMIT',
      owner: 'BOT_NOISE',
    });
    expect(buyRes.rejected).toBe(false);
    expect(buyRes.trades.length).toBe(1);
    expect(buyRes.trades[0].price).toBe(100.10);
    expect(buyRes.trades[0].quantity).toBe(30);

    // Check remaining ask quantity
    const snapshot = engine.getSnapshot();
    expect(snapshot.asks[0].price).toBe(100.10);
    expect(snapshot.asks[0].totalQuantity).toBe(20);
  });

  it('should reject POST_ONLY orders that would cross spread', () => {
    const engine = new MatchingEngine(100.0, 0.05);

    engine.submitOrder({
      side: 'SELL',
      price: 100.10,
      quantity: 50,
      type: 'LIMIT',
      owner: 'PLAYER',
    });

    const postOnlyRes = engine.submitOrder({
      side: 'BUY',
      price: 100.15,
      quantity: 10,
      type: 'POST_ONLY',
      owner: 'PLAYER',
    });

    expect(postOnlyRes.rejected).toBe(true);
    expect(postOnlyRes.trades.length).toBe(0);
  });

  it('should cancel IOC residual if not fully filled', () => {
    const engine = new MatchingEngine(100.0, 0.05);

    engine.submitOrder({
      side: 'SELL',
      price: 100.10,
      quantity: 15,
      type: 'LIMIT',
      owner: 'PLAYER',
    });

    const iocRes = engine.submitOrder({
      side: 'BUY',
      price: 100.10,
      quantity: 40,
      type: 'IOC',
      owner: 'PLAYER',
    });

    expect(iocRes.trades.length).toBe(1);
    expect(iocRes.trades[0].quantity).toBe(15);
    expect(iocRes.order.status).toBe('PARTIALLY_FILLED');

    // Ensure remaining 25 was cancelled and not resting on book
    const snapshot = engine.getSnapshot();
    expect(snapshot.bids.length).toBe(0);
  });
});
