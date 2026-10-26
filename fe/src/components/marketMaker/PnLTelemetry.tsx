import React from 'react';
import { PlayerInventory } from '../../types/game';
import { Award, BarChart3, DollarSign, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface PnLTelemetryProps {
  inventory: PlayerInventory;
}

export const PnLTelemetry: React.FC<PnLTelemetryProps> = ({ inventory }) => {
  const isPnlPositive = inventory.totalPnl >= 0;
  const winRatePercent = inventory.totalTrades > 0
    ? Math.round((inventory.winningTrades / inventory.totalTrades) * 100)
    : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '10px',
    }}>
      {/* Total PnL */}
      <div className="glass-panel" style={{ padding: '12px', borderLeft: `3px solid ${isPnlPositive ? 'var(--color-bid)' : 'var(--color-ask)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>TOTAL PNL</span>
          <DollarSign size={13} />
        </div>
        <div className="mono" style={{
          fontSize: '18px',
          fontWeight: 800,
          marginTop: '4px',
          color: isPnlPositive ? 'var(--color-bid)' : 'var(--color-ask)',
        }}>
          {isPnlPositive ? `+$${inventory.totalPnl.toFixed(2)}` : `-$${Math.abs(inventory.totalPnl).toFixed(2)}`}
        </div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Real: ${inventory.realizedPnl.toFixed(2)} | Unr: ${inventory.unrealizedPnl.toFixed(2)}
        </div>
      </div>

      {/* Net Position / Inventory */}
      <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-cyan)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>POSITION (q)</span>
          <Zap size={13} color="var(--color-cyan)" />
        </div>
        <div className="mono" style={{
          fontSize: '18px',
          fontWeight: 800,
          marginTop: '4px',
          color: inventory.position > 0 ? 'var(--color-bid)' : inventory.position < 0 ? 'var(--color-ask)' : 'var(--text-primary)',
        }}>
          {inventory.position > 0 ? `+${inventory.position}` : inventory.position}
        </div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Avg: {inventory.averageEntryPrice > 0 ? `$${inventory.averageEntryPrice.toFixed(2)}` : '--'}
        </div>
      </div>

      {/* Sharpe Ratio */}
      <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-purple)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>SHARPE RATIO</span>
          <Award size={13} color="var(--color-purple)" />
        </div>
        <div className="mono" style={{
          fontSize: '18px',
          fontWeight: 800,
          marginTop: '4px',
          color: inventory.sharpeRatio >= 1.5 ? 'var(--color-bid)' : 'var(--text-primary)',
        }}>
          {inventory.sharpeRatio.toFixed(2)}
        </div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Max DD: -${inventory.maxDrawdown.toFixed(2)}
        </div>
      </div>

      {/* Win Rate & Volume */}
      <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-amber)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>WIN RATE</span>
          <BarChart3 size={13} color="var(--color-amber)" />
        </div>
        <div className="mono" style={{
          fontSize: '18px',
          fontWeight: 800,
          marginTop: '4px',
          color: winRatePercent >= 50 ? 'var(--color-bid)' : 'var(--color-ask)',
        }}>
          {winRatePercent}%
        </div>
        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Vol: {inventory.volumeTraded} ({inventory.totalTrades} fills)
        </div>
      </div>
    </div>
  );
};
