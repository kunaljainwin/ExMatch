import React, { useEffect, useRef } from 'react';
import { Trade } from '../../types/engine';

interface MicroTickChartProps {
  trades: Trade[];
  lastPrice: number | null;
}

export const MicroTickChart: React.FC<MicroTickChartProps> = ({ trades, lastPrice }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Background clear
    ctx.clearRect(0, 0, width, height);

    if (trades.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WAITING FOR EXECUTION TRADES...', width / 2, height / 2);
      return;
    }

    // Determine min and max prices
    const prices = trades.map(t => t.price);
    const minPrice = Math.min(...prices) - 0.15;
    const maxPrice = Math.max(...prices) + 0.15;
    const priceRange = Math.max(0.3, maxPrice - minPrice);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      const labelPrice = maxPrice - (i / 5) * priceRange;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('$' + labelPrice.toFixed(2), width - 8, y - 4);
    }

    // Gradient tick curve
    const xStep = width / (trades.length - 1);
    ctx.beginPath();
    trades.forEach((trade, i) => {
      const x = i * xStep;
      const y = height - ((trade.price - minPrice) / priceRange) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Area fill under curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw trade execution dots
    trades.slice(-20).forEach((trade, idx) => {
      const realIdx = trades.length - 20 + idx;
      if (realIdx < 0) return;
      const x = realIdx * xStep;
      const y = height - ((trade.price - minPrice) / priceRange) * height;

      ctx.beginPath();
      ctx.arc(x, y, trade.quantity > 50 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = trade.side === 'BUY' ? '#00f59b' : '#ff3366';
      ctx.fill();
    });
  }, [trades]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {lastPrice !== null && (
        <div className="mono" style={{
          position: 'absolute',
          top: '10px',
          left: '12px',
          fontSize: '11px',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-subtle)',
          color: 'var(--color-cyan)',
          fontWeight: 700,
        }}>
          LAST TICK: ${lastPrice.toFixed(2)}
        </div>
      )}
    </div>
  );
};
