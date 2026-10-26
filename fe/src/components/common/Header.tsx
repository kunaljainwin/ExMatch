import React from 'react';
import { Activity, Crosshair, HelpCircle, Layers, Volume2, VolumeX, Zap } from 'lucide-react';
import { audio } from '../../engine/audioService';

export type ActiveTab = 'MARKET_MAKER' | 'LATENCY_ARB' | 'TERMINAL_STRESS';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  sequenceId: number;
  lastPrice: number | null;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  sequenceId,
  lastPrice,
  onOpenHelp,
}) => {
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const toggleSound = () => {
    audio.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  return (
    <header className="glass-panel" style={{
      margin: '12px 16px',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      {/* Brand & Live Beacon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 245, 155, 0.15))',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(0, 229, 255, 0.3)',
        }}>
          <Zap size={18} color="var(--color-cyan)" />
          <span style={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '15px' }}>
            <span style={{ color: 'var(--color-cyan)' }}>EX</span>MATCH
          </span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(0, 245, 155, 0.2)',
            color: 'var(--color-bid)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            HFT Engine
          </span>
        </div>

        {/* Real-time Ticker & Sequence ID */}
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div>
            SEQ: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>#{sequenceId.toLocaleString()}</span>
          </div>
          {lastPrice !== null && (
            <div>
              LAST: <span style={{ color: 'var(--color-cyan)', fontWeight: 700, fontSize: '13px' }}>${lastPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav Tabs */}
      <nav style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => onTabChange('MARKET_MAKER')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            background: activeTab === 'MARKET_MAKER' ? 'rgba(0, 245, 155, 0.15)' : 'transparent',
            color: activeTab === 'MARKET_MAKER' ? 'var(--color-bid)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'MARKET_MAKER' ? 'inset 0 0 0 1px rgba(0, 245, 155, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={15} />
          The Market Maker
        </button>

        <button
          onClick={() => onTabChange('LATENCY_ARB')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            background: activeTab === 'LATENCY_ARB' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
            color: activeTab === 'LATENCY_ARB' ? 'var(--color-cyan)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'LATENCY_ARB' ? 'inset 0 0 0 1px rgba(0, 229, 255, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Crosshair size={15} />
          Latency Sniping Arena
        </button>

        <button
          onClick={() => onTabChange('TERMINAL_STRESS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            background: activeTab === 'TERMINAL_STRESS' ? 'rgba(255, 183, 3, 0.15)' : 'transparent',
            color: activeTab === 'TERMINAL_STRESS' ? 'var(--color-amber)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'TERMINAL_STRESS' ? 'inset 0 0 0 1px rgba(255, 183, 3, 0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={15} />
          Exchange Terminal & Stress-Test
        </button>
      </nav>

      {/* Utility Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggleSound}
          title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: soundEnabled ? 'var(--color-bid)' : 'var(--text-muted)',
            padding: '7px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button
          onClick={onOpenHelp}
          title="Game Manual & Formulas"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            padding: '7px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <HelpCircle size={15} />
          Manual
        </button>
      </div>
    </header>
  );
};
