import { MatchingEngine } from './matchingEngine';
import { Side, Trade } from '../types/engine';

export class MarketBotSimulator {
  private engine: MatchingEngine;
  private intervalId: number | null = null;
  private onTradeCallback?: (trades: Trade[]) => void;
  private currentRegime: 'NORMAL' | 'TRENDING_UP' | 'TRENDING_DOWN' | 'VOLATILE' | 'FLASH_CRASH' = 'NORMAL';
  private regimeTimeout = 0;
  private tickSize = 0.05;

  constructor(engine: MatchingEngine, tickSize = 0.05) {
    this.engine = engine;
    this.tickSize = tickSize;
  }

  public setOnTrade(cb: (trades: Trade[]) => void) {
    this.onTradeCallback = cb;
  }

  public seedInitialBook(levels = 8, baseQty = 50) {
    const mid = this.engine.getLastTradePrice() || 100.0;
    for (let i = 1; i <= levels; i++) {
      const bidPrice = Number((mid - i * this.tickSize).toFixed(2));
      const askPrice = Number((mid + i * this.tickSize).toFixed(2));
      const qty = baseQty + Math.floor(Math.random() * 40);

      this.engine.submitOrder({
        side: 'BUY',
        price: bidPrice,
        quantity: qty,
        type: 'LIMIT',
        owner: 'BOT_NOISE',
      });

      this.engine.submitOrder({
        side: 'SELL',
        price: askPrice,
        quantity: qty,
        type: 'LIMIT',
        owner: 'BOT_NOISE',
      });
    }
  }

  public start(frequencyMs = 120) {
    if (this.intervalId !== null) return;
    this.seedInitialBook();

    this.intervalId = window.setInterval(() => {
      this.step();
    }, frequencyMs);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public triggerFlashCrash() {
    this.currentRegime = 'FLASH_CRASH';
    this.regimeTimeout = 30; // 30 steps of intense downward shock
  }

  private step() {
    if (this.regimeTimeout > 0) {
      this.regimeTimeout--;
      if (this.regimeTimeout === 0) {
        this.currentRegime = 'NORMAL';
      }
    } else {
      // Small chance to randomly switch regime
      const roll = Math.random();
      if (roll < 0.02) {
        this.currentRegime = Math.random() > 0.5 ? 'TRENDING_UP' : 'TRENDING_DOWN';
        this.regimeTimeout = 25;
      } else if (roll < 0.04) {
        this.currentRegime = 'VOLATILE';
        this.regimeTimeout = 20;
      }
    }

    const mid = this.engine.getLastTradePrice() || 100.0;
    const allTrades: Trade[] = [];

    if (this.currentRegime === 'FLASH_CRASH') {
      // Rapidly hit bids with aggressive market sells
      const { trades } = this.engine.submitOrder({
        side: 'SELL',
        price: 0,
        quantity: 80 + Math.floor(Math.random() * 80),
        type: 'MARKET',
        owner: 'BOT_INFORMED',
      });
      allTrades.push(...trades);

      // Re-seed asks aggressively lower
      this.engine.submitOrder({
        side: 'SELL',
        price: Number((mid - this.tickSize).toFixed(2)),
        quantity: 50,
        type: 'LIMIT',
        owner: 'BOT_NOISE',
      });
    } else {
      // 1. Noise Limit Orders (Liquidity Provision)
      const bidOffset = (1 + Math.floor(Math.random() * 5)) * this.tickSize;
      const askOffset = (1 + Math.floor(Math.random() * 5)) * this.tickSize;

      this.engine.submitOrder({
        side: 'BUY',
        price: Number((mid - bidOffset).toFixed(2)),
        quantity: 10 + Math.floor(Math.random() * 30),
        type: 'LIMIT',
        owner: 'BOT_NOISE',
      });

      this.engine.submitOrder({
        side: 'SELL',
        price: Number((mid + askOffset).toFixed(2)),
        quantity: 10 + Math.floor(Math.random() * 30),
        type: 'LIMIT',
        owner: 'BOT_NOISE',
      });

      // 2. Market Taker Orders (Liquidity Consumption)
      const shouldTake = Math.random() < 0.45;
      if (shouldTake) {
        let side: Side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        if (this.currentRegime === 'TRENDING_UP') side = Math.random() > 0.25 ? 'BUY' : 'SELL';
        if (this.currentRegime === 'TRENDING_DOWN') side = Math.random() > 0.25 ? 'SELL' : 'BUY';

        const { trades } = this.engine.submitOrder({
          side,
          price: 0,
          quantity: 10 + Math.floor(Math.random() * 25),
          type: 'MARKET',
          owner: 'BOT_NOISE',
        });
        allTrades.push(...trades);
      }

      // 3. Periodic Iceberg / Large block replenishment
      if (Math.random() < 0.15) {
        const side: Side = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const price = side === 'BUY'
          ? Number((mid - 2 * this.tickSize).toFixed(2))
          : Number((mid + 2 * this.tickSize).toFixed(2));

        this.engine.submitOrder({
          side,
          price,
          quantity: 150,
          type: 'LIMIT',
          owner: 'BOT_ICEBERG',
        });
      }
    }

    if (allTrades.length > 0 && this.onTradeCallback) {
      this.onTradeCallback(allTrades);
    }
  }
}
