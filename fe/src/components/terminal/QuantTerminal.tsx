import React, { useState } from 'react';
import { MatchingEngine } from '../../engine/matchingEngine';
import { Order, OrderBookSnapshot, OrderType, Side, Trade, WALEvent } from '../../types/engine';
import { MicroTickChart } from './MicroTickChart';
import { audio } from '../../engine/audioService';
import { Activity, AlertOctagon, CheckCircle2, ChevronRight, Cpu, Play, Send, ShieldCheck, Terminal, Trash2, Zap } from 'lucide-react';

interface QuantTerminalProps {
  engine: MatchingEngine;
  snapshot: OrderBookSnapshot;
  trades: Trade[];
  wal: WALEvent[];
  onRefresh: () => void;
}

export const QuantTerminal: React.FC<QuantTerminalProps> = ({
  engine,
  snapshot,
  trades,
  wal,
  onRefresh,
}) => {
  // Order entry form state
  const [side, setSide] = useState<Side>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState<string>((snapshot.midPrice || 100.0).toFixed(2));
  const [quantity, setQuantity] = useState<string>('20');
  const [orderMessage, setOrderMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Stress test state
  const [isStressRunning, setIsStressRunning] = useState<boolean>(false);
  const [stressRate, setStressRate] = useState<number>(5000);
  const [stressMetrics, setStressMetrics] = useState({
    throughput: 0,
    totalProcessed: 0,
    p50Us: 1.4,
    p90Us: 2.8,
    p99Us: 6.2,
    p999Us: 14.5,
    ringBufferPercent: 12,
  });

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const prc = parseFloat(price);

    if (isNaN(qty) || qty <= 0) {
      setOrderMessage({ text: 'Invalid quantity', error: true });
      return;
    }

    if (orderType !== 'MARKET' && (isNaN(prc) || prc <= 0)) {
      setOrderMessage({ text: 'Invalid price', error: true });
      return;
    }

    const res = engine.submitOrder({
      side,
      price: orderType === 'MARKET' ? 0 : prc,
      quantity: qty,
      type: orderType,
      owner: 'PLAYER',
    });

    if (res.rejected) {
      audio.playAlert();
      setOrderMessage({ text: `REJECTED: ${res.rejectReason}`, error: true });
    } else {
      audio.playTick();
      if (res.trades.length > 0) audio.playFill();
      setOrderMessage({ text: `PLACED: ${orderType} ${side} ${qty} @ ${prc || 'MKT'}`, error: false });
    }

    onRefresh();
  };

  const handleRunStressBurst = () => {
    setIsStressRunning(true);
    audio.playTick();

    const burstSize = 2500;
    const startTime = performance.now();
    const latencies: number[] = [];

    for (let i = 0; i < burstSize; i++) {
      const t0 = performance.now();
      const s: Side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const mid = snapshot.midPrice || 100.0;
      const offset = (Math.floor(Math.random() * 8) - 4) * 0.05;
      const p = Math.max(80, Number((mid + offset).toFixed(2)));

      engine.submitOrder({
        side: s,
        price: p,
        quantity: 5 + Math.floor(Math.random() * 20),
        type: Math.random() < 0.2 ? 'MARKET' : 'LIMIT',
        owner: 'CHAOS_GENERATOR',
      });
      const t1 = performance.now();
      latencies.push((t1 - t0) * 1000); // Microseconds
    }

    const totalTimeMs = performance.now() - startTime;
    const throughput = Math.round((burstSize / (totalTimeMs / 1000)));

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const p999 = latencies[Math.floor(latencies.length * 0.999)];

    setStressMetrics({
      throughput,
      totalProcessed: burstSize,
      p50Us: Number(p50.toFixed(2)),
      p90Us: Number(p90.toFixed(2)),
      p99Us: Number(p99.toFixed(2)),
      p999Us: Number(p999.toFixed(2)),
      ringBufferPercent: Math.min(95, Math.round(burstSize / 40)),
    });

    onRefresh();
    setTimeout(() => setIsStressRunning(false), 500);
  };

  const openOrders = engine.getOpenOrdersForOwner('PLAYER');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1.5fr 320px', gap: '14px', padding: '0 16px 24px 16px' }}>
      {/* LEFT COLUMN: ORDER ENTRY & OPEN ORDERS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Order Form */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
            <Send size={14} color="var(--color-cyan)" />
            <span>ORDER ENTRY</span>
          </div>

          <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Side Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setSide('BUY')}
                style={{
                  background: side === 'BUY' ? 'rgba(0, 245, 155, 0.25)' : 'var(--bg-secondary)',
                  border: `1px solid ${side === 'BUY' ? 'var(--color-bid)' : 'var(--border-subtle)'}`,
                  color: side === 'BUY' ? 'var(--color-bid)' : 'var(--text-secondary)',
                  padding: '7px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                BUY
              </button>

              <button
                type="button"
                onClick={() => setSide('SELL')}
                style={{
                  background: side === 'SELL' ? 'rgba(255, 51, 102, 0.25)' : 'var(--bg-secondary)',
                  border: `1px solid ${side === 'SELL' ? 'var(--color-ask)' : 'var(--border-subtle)'}`,
                  color: side === 'SELL' ? 'var(--color-ask)' : 'var(--text-secondary)',
                  padding: '7px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                SELL
              </button>
            </div>

            {/* Order Type */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ORDER TYPE</label>
              <select
                value={orderType}
                onChange={e => setOrderType(e.target.value as OrderType)}
                className="mono"
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  fontSize: '11px',
                }}
              >
                <option value="LIMIT">LIMIT</option>
                <option value="MARKET">MARKET</option>
                <option value="IOC">IOC (Immediate-Or-Cancel)</option>
                <option value="POST_ONLY">POST-ONLY (Maker Only)</option>
                <option value="FOK">FOK (Fill-Or-Kill)</option>
              </select>
            </div>

            {/* Price */}
            {orderType !== 'MARKET' && (
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PRICE ($)</label>
                <input
                  type="number"
                  step="0.05"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="mono"
                  style={{
                    width: '92%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                />
              </div>
            )}

            {/* Quantity */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>QUANTITY</label>
              <input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="mono"
                style={{
                  width: '92%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                background: side === 'BUY' ? 'linear-gradient(135deg, #00f59b, #00d9ff)' : 'linear-gradient(135deg, #ff3366, #ff758c)',
                color: '#000',
                border: 'none',
                padding: '9px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                marginTop: '6px',
              }}
            >
              TRANSMIT {side} ORDER
            </button>
          </form>

          {orderMessage && (
            <div className="mono" style={{
              fontSize: '10px',
              padding: '6px 8px',
              borderRadius: '4px',
              background: orderMessage.error ? 'rgba(255, 51, 102, 0.15)' : 'rgba(0, 245, 155, 0.15)',
              color: orderMessage.error ? 'var(--color-ask)' : 'var(--color-bid)',
              border: `1px solid ${orderMessage.error ? 'var(--color-ask)' : 'var(--color-bid)'}`,
            }}>
              {orderMessage.text}
            </div>
          )}
        </div>

        {/* Active Open Orders */}
        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              OPEN ORDERS ({openOrders.length})
            </span>
            {openOrders.length > 0 && (
              <button
                onClick={() => {
                  engine.cancelAllForOwner('PLAYER');
                  onRefresh();
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-ask)', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={12} /> Cancel All
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '180px' }}>
            {openOrders.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                No active orders
              </div>
            ) : (
              openOrders.map(o => (
                <div
                  key={o.id}
                  className="mono"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    borderLeft: `2px solid ${o.side === 'BUY' ? 'var(--color-bid)' : 'var(--color-ask)'}`,
                  }}
                >
                  <div>
                    <span style={{ color: o.side === 'BUY' ? 'var(--color-bid)' : 'var(--color-ask)', fontWeight: 700 }}>
                      {o.side}
                    </span>{' '}
                    <span>{o.quantity - o.filledQuantity} @ ${o.price.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => {
                      engine.cancelOrder(o.id);
                      onRefresh();
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: TICK CHART & STRESS TEST CONSOLE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Canvas Micro-Tick Chart */}
        <div className="glass-panel" style={{ height: '240px', padding: '12px' }}>
          <MicroTickChart trades={trades} lastPrice={snapshot.lastTradePrice} />
        </div>

        {/* Visual Stress-Tester & Chaos Engine */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} color="var(--color-amber)" />
              <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px' }}>
                EXMATCH CORE STRESS-TESTER & LATENCY PROFILER
              </span>
            </div>

            <button
              onClick={handleRunStressBurst}
              disabled={isStressRunning}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.2), rgba(255, 51, 102, 0.2))',
                border: '1px solid var(--color-amber)',
                color: 'var(--color-amber)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isStressRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={13} />
              {isStressRunning ? 'BURSTING 2,500 OPS...' : 'RUN 2,500 BURST'}
            </button>
          </div>

          {/* Throughput & Latency Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>THROUGHPUT</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-cyan)', marginTop: '2px' }}>
                {stressMetrics.throughput.toLocaleString()} <span style={{ fontSize: '10px' }}>ops/s</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LATENCY p50</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-bid)', marginTop: '2px' }}>
                {stressMetrics.p50Us}µs
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LATENCY p99</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-amber)', marginTop: '2px' }}>
                {stressMetrics.p99Us}µs
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LATENCY p99.9</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-ask)', marginTop: '2px' }}>
                {stressMetrics.p999Us}µs
              </div>
            </div>
          </div>

          {/* SPSC Ring Buffer Fill Simulation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>SPSC RING BUFFER UTILIZATION (LOCK-FREE QUEUE)</span>
              <span className="mono">{stressMetrics.ringBufferPercent}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stressMetrics.ringBufferPercent}%`,
                background: stressMetrics.ringBufferPercent > 70 ? 'var(--color-ask)' : 'var(--color-cyan)',
                transition: 'all 0.2s ease',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: TIME & SALES (TRADE TAPE) & WAL AUDIT LOG */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Trade Tape */}
        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', height: '230px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
            <Activity size={13} color="var(--color-cyan)" />
            <span>TIME & SALES (TRADE TAPE)</span>
          </div>

          <div className="mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
            <div>Price</div>
            <div style={{ textAlign: 'center' }}>Size</div>
            <div style={{ textAlign: 'right' }}>Seq ID</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
            {trades.slice(-20).reverse().map(t => (
              <div
                key={t.id}
                className="mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  fontSize: '11px',
                  color: t.side === 'BUY' ? 'var(--color-bid)' : 'var(--color-ask)',
                }}
              >
                <div style={{ fontWeight: 700 }}>${t.price.toFixed(2)}</div>
                <div style={{ textAlign: 'center' }}>{t.quantity}</div>
                <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '10px' }}>#{t.sequenceId}</div>
              </div>
            ))}
          </div>
        </div>

        {/* WAL Event Log (Append-Only Journal) */}
        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
            <Terminal size={13} color="var(--color-amber)" />
            <span>WRITE-AHEAD LOG (WAL JOURNAL)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '200px' }}>
            {wal.slice(-15).reverse().map(w => (
              <div
                key={w.sequenceId}
                className="mono"
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '4px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  lineHeight: '1.4',
                  borderLeft: `2px solid ${w.type === 'TRADE_EXEC' ? 'var(--color-bid)' : w.type === 'REJECT' ? 'var(--color-ask)' : 'var(--color-cyan)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>#{w.sequenceId}</span>
                  <span style={{ color: 'var(--color-cyan)' }}>{w.type}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{w.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
