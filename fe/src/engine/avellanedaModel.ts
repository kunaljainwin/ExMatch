import { AvellanedaOutput, AvellanedaParams } from '../types/game';

/**
 * Avellaneda-Stoikov (2008) High-Frequency Market Making Model
 * 
 * r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
 * delta_a + delta_b = (2 / gamma) * ln(1 + gamma / kappa)
 */
export function calculateAvellanedaQuotes(
  midPrice: number,
  inventory: number,
  params: AvellanedaParams,
  tickSize = 0.05
): AvellanedaOutput {
  const { riskAversion, volatility, timeHorizon, orderIntensity } = params;

  // Reservation Price (fair value adjusted for inventory risk aversion)
  const inventoryPenalty = inventory * riskAversion * Math.pow(volatility, 2) * timeHorizon;
  const reservationPrice = midPrice - inventoryPenalty;

  // Optimal Half-Spread
  const totalSpread = (2 / riskAversion) * Math.log(1 + riskAversion / orderIntensity);
  const halfSpread = Math.max(tickSize, totalSpread / 2);

  // Raw optimal quotes
  const optimalBid = Math.floor((reservationPrice - halfSpread) / tickSize) * tickSize;
  const optimalAsk = Math.ceil((reservationPrice + halfSpread) / tickSize) * tickSize;

  const skewTicks = Math.round((reservationPrice - midPrice) / tickSize);

  return {
    reservationPrice: Number(reservationPrice.toFixed(2)),
    optimalBid: Number(optimalBid.toFixed(2)),
    optimalAsk: Number(optimalAsk.toFixed(2)),
    halfSpread: Number(halfSpread.toFixed(2)),
    skewTicks,
  };
}
