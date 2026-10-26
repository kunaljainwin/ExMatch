import { describe, expect, it } from 'vitest';
import { calculateAvellanedaQuotes } from '../engine/avellanedaModel';

describe('Avellaneda-Stoikov Market Making Model Tests', () => {
  const params = {
    riskAversion: 0.15,
    volatility: 0.5,
    timeHorizon: 1.0,
    orderIntensity: 1.5,
  };

  it('should compute neutral reservation price when inventory is zero', () => {
    const mid = 100.0;
    const res = calculateAvellanedaQuotes(mid, 0, params);
    expect(res.reservationPrice).toBe(100.0);
    expect(res.skewTicks).toBe(0);
    expect(res.optimalBid).toBeLessThan(mid);
    expect(res.optimalAsk).toBeGreaterThan(mid);
  });

  it('should skew reservation price lower when holding long inventory (q > 0)', () => {
    const mid = 100.0;
    const res = calculateAvellanedaQuotes(mid, 50, params);
    // When holding long position (q=50), reservation price should drop below mid to induce selling
    expect(res.reservationPrice).toBeLessThan(mid);
    expect(res.skewTicks).toBeLessThan(0);
  });

  it('should skew reservation price higher when holding short inventory (q < 0)', () => {
    const mid = 100.0;
    const res = calculateAvellanedaQuotes(mid, -50, params);
    // When holding short position (q=-50), reservation price should rise above mid to induce buying
    expect(res.reservationPrice).toBeGreaterThan(mid);
    expect(res.skewTicks).toBeGreaterThan(0);
  });
});
