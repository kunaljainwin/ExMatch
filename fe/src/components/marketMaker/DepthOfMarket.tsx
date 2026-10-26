import React from 'react';
import { OrderBookSnapshot } from '../../types/engine';
import { AvellanedaOutput } from '../../types/game';
import { ArrowDown, ArrowUp, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import { audio } from '../../engine/audioService';

interface DepthOfMarketProps {
  snapshot: OrderBookSnapshot;
  avellaneda: AvellanedaOutput;
  onPlaceLimitOrder: (side: 'BUY' | 'SELL', price: number, quantity: number) => void;
  onCancelAll: () => void;
  onFlattenInventory: () => void;
  onQuoteAvellanedaSpread: () => void;
  playerInventory: number;
}

export const DepthOfMarket: React.FC<DepthOfMarketProps> = ({
  snapshot,
  avellaneda,
  onPlaceLimitOrder,
  onCancelAll,
  onFlattenInventory,
  onQuoteAvellanedaSpread,
  playerInventory,
}) => {
  const [selectedLotSize, setSelectedLotSize] = React.useState<number>(10);

  // Determine max volume for depth bar scaling
  const maxVolume = Math.max(
    ...snapshot.bids.map(b => b.totalQuantity),
    ...snapshot.asks.map(a => a.totalQuantity),
    100
  );

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
      {/* DOM Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>LEVEL-2 DEPTH LADDER</span>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            TICK: $0.05
          </span>
        </div>

        {/* Lot Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>LOT SIZE:</span>
          {[5, 10, 25, 50, 100].map(qty => (
            <button
              key={qty}
              onClick={() => setSelectedLotSize(qty)}
              className="mono"
              style={{
                background: selectedLotSize === qty ? 'var(--color-cyan)' : 'var(--bg-secondary)',
                color: selectedLotSize === qty ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        <button
          onClick={() => {
            audio.playTick();
            onQuoteAvellanedaSpread();
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 245, 155, 0.2))',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            color: 'var(--color-cyan)',
            padding: '8px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} />
          Quote AS Model
        </button>

        <button
          onClick={() => {
            audio.playTick();
            onCancelAll();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            padding: '8px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <XCircle size={14} />
          Cancel All (C)
        </button>

        <button
          onClick={() => {
            audio.playAlert();
            onFlattenInventory();
          }}
          disabled={playerInventory === 0}
          style={{
            background: playerInventory !== 0 ? 'rgba(255, 51, 102, 0.2)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${playerInventory !== 0 ? 'var(--color-ask)' : 'var(--border-subtle)'}`,
            color: playerInventory !== 0 ? 'var(--color-ask)' : 'var(--text-muted)',
            padding: '8px 10px',
            borderRadius: '6px',
            cursor: playerInventory !== 0 ? 'pointer' : 'not-allowed',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ShieldAlert size={14} />
          FLATTEN (F)
        </button>
      </div>

      {/* DOM Ladder View */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div className="mono" style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          <div>Bid Vol (1-Click)</div>
          <div style={{ textAlign: 'center' }}>Price</div>
          <div style={{ textAlign: 'center' }}>My Orders</div>
          <div style={{ textAlign: 'right' }}>Ask Vol (1-Click)</div>
        </div>

        {/* ASKS (Rendered in reverse order so lowest ask is near the spread) */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          {snapshot.asks.slice(0, 7).map(level => {
            const isAvellanedaTarget = Math.abs(level.price - avellaneda.optimalAsk) < 0.01;
            const barWidthPercent = Math.min(100, (level.totalQuantity / maxVolume) * 100);

            return (
              <div
                key={'ask_' + level.price}
                className="mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
                  padding: '5px 12px',
                  alignItems: 'center',
                  fontSize: '12px',
                  position: 'relative',
                  background: isAvellanedaTarget ? 'rgba(255, 183, 3, 0.12)' : 'transparent',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                }}
              >
                {/* Ask Depth Background Bar (originates from right) */}
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${barWidthPercent}%`,
                  background: 'var(--color-ask-bg)',
                  pointerEvents: 'none',
                }} />

                <div></div>

                {/* Price Column */}
                <div style={{ textAlign: 'center', color: 'var(--color-ask)', fontWeight: 700 }}>
                  ${level.price.toFixed(2)}
                </div>

                {/* Player active quantity */}
                <div style={{ textAlign: 'center', color: 'var(--color-cyan)', fontWeight: 700 }}>
                  {level.playerQuantity > 0 ? `[${level.playerQuantity}]` : '-'}
                </div>

                {/* Ask Volume / Click to Sell */}
                <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', zIndex: 1 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{level.totalQuantity}</span>
                  <button
                    onClick={() => {
                      audio.playTick();
                      onPlaceLimitOrder('SELL', level.price, selectedLotSize);
                    }}
                    title={`Place Limit Sell ${selectedLotSize}@${level.price.toFixed(2)}`}
                    style={{
                      background: 'rgba(255, 51, 102, 0.25)',
                      border: '1px solid var(--color-ask)',
                      color: 'var(--color-ask)',
                      borderRadius: '3px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    SELL
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* SPREAD INDICATOR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          background: 'rgba(0, 229, 255, 0.08)',
          borderTop: '1px solid rgba(0, 229, 255, 0.25)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
          fontSize: '11px',
        }}>
          <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-cyan)' }}>
            <span>SPREAD:</span>
            <span style={{ fontWeight: 800 }}>${snapshot.spread !== null ? snapshot.spread.toFixed(2) : '--'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              ({snapshot.spread !== null ? Math.round(snapshot.spread / 0.05) : 0} ticks)
            </span>
          </div>

          <div className="mono" style={{ color: 'var(--text-secondary)' }}>
            MID: <span style={{ color: '#fff', fontWeight: 700 }}>${snapshot.midPrice?.toFixed(2)}</span>
          </div>
        </div>

        {/* BIDS */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {snapshot.bids.slice(0, 7).map(level => {
            const isAvellanedaTarget = Math.abs(level.price - avellaneda.optimalBid) < 0.01;
            const barWidthPercent = Math.min(100, (level.totalQuantity / maxVolume) * 100);

            return (
              <div
                key={'bid_' + level.price}
                className="mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
                  padding: '5px 12px',
                  alignItems: 'center',
                  fontSize: '12px',
                  position: 'relative',
                  background: isAvellanedaTarget ? 'rgba(255, 183, 3, 0.12)' : 'transparent',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                }}
              >
                {/* Bid Depth Background Bar (originates from left) */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${barWidthPercent}%`,
                  background: 'var(--color-bid-bg)',
                  pointerEvents: 'none',
                }} />

                {/* Bid Volume / Click to Buy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 1 }}>
                  <button
                    onClick={() => {
                      audio.playTick();
                      onPlaceLimitOrder('BUY', level.price, selectedLotSize);
                    }}
                    title={`Place Limit Buy ${selectedLotSize}@${level.price.toFixed(2)}`}
                    style={{
                      background: 'rgba(0, 245, 155, 0.25)',
                      border: '1px solid var(--color-bid)',
                      color: 'var(--color-bid)',
                      borderRadius: '3px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    BUY
                  </button>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{level.totalQuantity}</span>
                </div>

                {/* Price Column */}
                <div style={{ textAlign: 'center', color: 'var(--color-bid)', fontWeight: 700 }}>
                  ${level.price.toFixed(2)}
                </div>

                {/* Player active quantity */}
                <div style={{ textAlign: 'center', color: 'var(--color-cyan)', fontWeight: 700 }}>
                  {level.playerQuantity > 0 ? `[${level.playerQuantity}]` : '-'}
                </div>

                <div></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
