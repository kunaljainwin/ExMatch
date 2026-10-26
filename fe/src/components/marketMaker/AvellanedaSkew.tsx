import React from 'react';
import { AvellanedaOutput, AvellanedaParams } from '../../types/game';
import { Compass, HelpCircle, Sliders } from 'lucide-react';

interface AvellanedaSkewProps {
  output: AvellanedaOutput;
  params: AvellanedaParams;
  onParamsChange: (newParams: AvellanedaParams) => void;
  inventory: number;
  midPrice: number | null;
}

export const AvellanedaSkew: React.FC<AvellanedaSkewProps> = ({
  output,
  params,
  onParamsChange,
  inventory,
  midPrice,
}) => {
  const [showFormula, setShowFormula] = React.useState(false);

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={16} color="var(--color-amber)" />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
            AVELLANEDA-STOIKOV INVENTORY SKEW
          </span>
        </div>

        <button
          onClick={() => setShowFormula(!showFormula)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
          }}
        >
          <HelpCircle size={13} />
          {showFormula ? 'Hide Math' : 'Formula'}
        </button>
      </div>

      {showFormula && (
        <div className="mono" style={{
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '10px 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
        }}>
          <div><strong style={{ color: 'var(--color-amber)' }}>Reservation Price:</strong> r(s, q, t) = s - q · γ · σ² · (T - t)</div>
          <div><strong style={{ color: 'var(--color-cyan)' }}>Optimal Half-Spread:</strong> δ = (1 / γ) · ln(1 + γ / κ)</div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
            When inventory q &gt; 0 (long), reservation price drops below mid to discourage buying and induce selling.
          </div>
        </div>
      )}

      {/* Skew Visual Meter */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Current Skew Angle:</span>
          <span className="mono" style={{
            fontWeight: 700,
            color: output.skewTicks > 0 ? 'var(--color-bid)' : output.skewTicks < 0 ? 'var(--color-ask)' : 'var(--text-primary)',
          }}>
            {output.skewTicks > 0 ? `+${output.skewTicks} ticks (Bullish Bias)` : output.skewTicks < 0 ? `${output.skewTicks} ticks (Bearish Skew)` : 'Neutral'}
          </span>
        </div>

        <div style={{
          height: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '3px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Center Line */}
          <div style={{ position: 'absolute', left: '50%', width: '2px', height: '100%', background: 'var(--border-subtle)' }} />
          {/* Skew Bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: output.skewTicks < 0 ? `${Math.max(5, 50 + output.skewTicks * 5)}%` : '50%',
            width: `${Math.min(45, Math.abs(output.skewTicks) * 5)}%`,
            background: output.skewTicks < 0 ? 'var(--color-ask)' : 'var(--color-bid)',
            borderRadius: '2px',
            transition: 'all 0.2s ease',
          }} />
        </div>

        <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px', marginTop: '4px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Opt Bid: </span>
            <span style={{ color: 'var(--color-bid)', fontWeight: 700 }}>${output.optimalBid.toFixed(2)}</span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Reserv. r: </span>
            <span style={{ color: 'var(--color-amber)', fontWeight: 700 }}>${output.reservationPrice.toFixed(2)}</span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', textAlign: 'right' }}>
            <span style={{ color: 'var(--text-muted)' }}>Opt Ask: </span>
            <span style={{ color: 'var(--color-ask)', fontWeight: 700 }}>${output.optimalAsk.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Model Parameter Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Sliders size={13} />
          <span>MODEL HYPERPARAMETERS</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Risk Aversion (γ):</span>
              <span className="mono">{params.riskAversion.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={params.riskAversion}
              onChange={e => onParamsChange({ ...params, riskAversion: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--color-amber)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Volatility (σ):</span>
              <span className="mono">{params.volatility.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={params.volatility}
              onChange={e => onParamsChange({ ...params, volatility: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
