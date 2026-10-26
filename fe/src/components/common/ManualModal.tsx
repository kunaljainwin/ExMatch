import React from 'react';
import { BookOpen, CheckCircle, Compass, Crosshair, Cpu, X } from 'lucide-react';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '720px',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 0 40px rgba(0, 229, 255, 0.2)',
        border: '1px solid rgba(0, 229, 255, 0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="var(--color-cyan)" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px' }}>
              EXMATCH HFT SUITE: MANUAL & GAMEPLAY GUIDE
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Section 1: The Market Maker Game */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-bid)', fontWeight: 700, fontSize: '14px' }}>
            <Compass size={16} />
            <span>1. The Market Maker Simulation (Avellaneda-Stoikov Model)</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            In high-frequency market making, your goal is to capture the bid-ask spread while actively avoiding <strong>inventory risk</strong> (accumulating too many long or short shares) and <strong>adverse selection</strong> (getting filled right before prices move against you).
          </p>
          <div className="mono" style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', fontSize: '11px', color: 'var(--color-amber)' }}>
            r(s, q, t) = s - q · γ · σ² · (T - t)
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <li><strong style={{ color: 'var(--text-primary)' }}>Reservation Price (r):</strong> The theoretical indifference price. When inventory q &gt; 0, your reservation price drops below mid to discourage buying and induce selling.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Flash Crash Mode:</strong> Simulates liquidity evaporation. Use <kbd>F</kbd> (Flatten) to immediately liquidate runaway exposure before getting wrecked.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Hotkeys:</strong> <kbd>Q</kbd> quotes Avellaneda-Stoikov spread, <kbd>F</kbd> flattens, <kbd>C</kbd> cancels all quotes.</li>
          </ul>
        </div>

        {/* Section 2: Latency Arbitrage & Sniping */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-cyan)', fontWeight: 700, fontSize: '14px' }}>
            <Crosshair size={16} />
            <span>2. Latency Arbitrage & Sniping Arena</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            In multi-venue electronic markets, faster reference venues (Venue A) update prices first. Market makers on local exchanges (Venue B) have a latency gap to cancel their resting stale limit orders.
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <li>Hit <strong style={{ color: 'var(--color-cyan)' }}>SPACEBAR</strong> or click the Snipe button as soon as a dislocation is triggered.</li>
            <li>If your simulated tick-to-trade latency beats the cancel window, you capture risk-free spread alpha.</li>
            <li>If you are too slow, your IOC order misses the queue or is rejected.</li>
          </ul>
        </div>

        {/* Section 3: ExMatch Architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-purple)', fontWeight: 700, fontSize: '14px' }}>
            <Cpu size={16} />
            <span>3. ExMatch C++ Architecture & Stress-Testing</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            The ExMatch engine utilizes an in-memory, single-writer deterministic matching architecture on dedicated CPU cores:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <li><strong>Lock-free SPSC Ring Buffer:</strong> Dedicated thread decouples I/O from the execution hot path.</li>
            <li><strong>Monotonic 64-bit Sequencing:</strong> Every order and trade has a strict, total monotonic event ID.</li>
            <li><strong>Durable WAL:</strong> Fast sequential append journal for zero-loss recovery and audit replay.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'var(--color-cyan)',
            color: '#000',
            border: 'none',
            padding: '10px',
            borderRadius: '6px',
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          GOT IT — ENTER THE ARENA
        </button>
      </div>
    </div>
  );
};
