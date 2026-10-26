import React, { useEffect, useRef, useState } from 'react';
import { ArbDislocation, ArbPlayerStats, VenueQuote } from '../../types/arbitrage';
import { audio } from '../../engine/audioService';
import { AlertCircle, CheckCircle, Crosshair, Flame, Play, ShieldAlert, Sparkles, Timer, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export const LatencyArbGame: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState<'NORMAL' | 'HFT_PRO' | 'ULTRA_FAST'>('NORMAL');

  // Venue state
  const [venueA, setVenueA] = useState<VenueQuote>({
    venue: 'VENUE_A_PRIMARY',
    bestBid: 100.00,
    bestAsk: 100.10,
    bidSize: 80,
    askSize: 80,
    timestamp: performance.now(),
  });

  const [venueB, setVenueB] = useState<VenueQuote>({
    venue: 'EXMATCH_LOCAL',
    bestBid: 100.00,
    bestAsk: 100.10,
    bidSize: 50,
    askSize: 50,
    timestamp: performance.now(),
  });

  const [activeOpportunity, setActiveOpportunity] = useState<ArbDislocation | null>(null);
  const [lastSnipeLog, setLastSnipeLog] = useState<string | null>(null);
  const [opportunityCount, setOpportunityCount] = useState(0);

  const [stats, setStats] = useState<ArbPlayerStats>({
    score: 0,
    totalAlphaCaptured: 0,
    snipesAttempted: 0,
    snipesSuccessful: 0,
    winRate: 0,
    avgLatencyUs: 0,
    bestLatencyUs: 9999,
    streak: 0,
  });

  const oppDiscoveredTimeRef = useRef<number>(0);

  // Difficulty parameters: Cancel delay for stale quotes in local venue
  const cancelWindowMs = difficulty === 'NORMAL' ? 1200 : difficulty === 'HFT_PRO' ? 700 : 400;

  // Simulator for lead-lag price dislocation
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Chance of a dislocation occurring
      if (!activeOpportunity && Math.random() < 0.4) {
        const shock = (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.floor(Math.random() * 3) * 0.10);
        const newPrimaryMid = Math.max(80, Number((venueA.bestBid + shock).toFixed(2)));

        // Update Venue A immediately
        const newVenueA: VenueQuote = {
          venue: 'VENUE_A_PRIMARY',
          bestBid: Number((newPrimaryMid - 0.05).toFixed(2)),
          bestAsk: Number((newPrimaryMid + 0.05).toFixed(2)),
          bidSize: 60 + Math.floor(Math.random() * 50),
          askSize: 60 + Math.floor(Math.random() * 50),
          timestamp: performance.now(),
        };
        setVenueA(newVenueA);

        // Check if there is an actionable price dislocation against Venue B's stale quotes
        if (shock > 0 && newVenueA.bestBid > venueB.bestAsk) {
          // Venue A surged higher: Buy on ExMatch (stale low ask) and sell on Venue A
          const arbSpread = Number((newVenueA.bestBid - venueB.bestAsk).toFixed(2));
          const opp: ArbDislocation = {
            id: 'arb_' + Date.now(),
            type: 'BUY_LOCAL_SELL_PRIMARY',
            priceDislocation: arbSpread,
            availableVolume: Math.min(newVenueA.bidSize, venueB.askSize),
            localPrice: venueB.bestAsk,
            primaryPrice: newVenueA.bestBid,
            discoveredAt: performance.now(),
            expiresAt: performance.now() + cancelWindowMs,
            status: 'ACTIVE',
          };
          oppDiscoveredTimeRef.current = performance.now();
          setActiveOpportunity(opp);
          setOpportunityCount(c => c + 1);
          audio.playAlert();
        } else if (shock < 0 && newVenueA.bestAsk < venueB.bestBid) {
          // Venue A plummeted lower: Sell on ExMatch (stale high bid) and buy on Venue A
          const arbSpread = Number((venueB.bestBid - newVenueA.bestAsk).toFixed(2));
          const opp: ArbDislocation = {
            id: 'arb_' + Date.now(),
            type: 'BUY_PRIMARY_SELL_LOCAL',
            priceDislocation: arbSpread,
            availableVolume: Math.min(newVenueA.askSize, venueB.bidSize),
            localPrice: venueB.bestBid,
            primaryPrice: newVenueA.bestAsk,
            discoveredAt: performance.now(),
            expiresAt: performance.now() + cancelWindowMs,
            status: 'ACTIVE',
          };
          oppDiscoveredTimeRef.current = performance.now();
          setActiveOpportunity(opp);
          setOpportunityCount(c => c + 1);
          audio.playAlert();
        }
      } else if (!activeOpportunity) {
        // Normal random jitter synchronizing both venues
        const jitter = (Math.random() - 0.5) * 0.1;
        const mid = Math.max(80, Number((venueA.bestBid + jitter).toFixed(2)));
        const qA: VenueQuote = {
          venue: 'VENUE_A_PRIMARY',
          bestBid: Number((mid - 0.05).toFixed(2)),
          bestAsk: Number((mid + 0.05).toFixed(2)),
          bidSize: 50 + Math.floor(Math.random() * 40),
          askSize: 50 + Math.floor(Math.random() * 40),
          timestamp: performance.now(),
        };
        const qB: VenueQuote = {
          venue: 'EXMATCH_LOCAL',
          bestBid: Number((mid - 0.05).toFixed(2)),
          bestAsk: Number((mid + 0.05).toFixed(2)),
          bidSize: 40 + Math.floor(Math.random() * 30),
          askSize: 40 + Math.floor(Math.random() * 30),
          timestamp: performance.now(),
        };
        setVenueA(qA);
        setVenueB(qB);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [isPlaying, activeOpportunity, venueA, venueB, difficulty]);

  // Handle expiration of active opportunity if player is too slow
  useEffect(() => {
    if (!activeOpportunity) return;

    const timer = setTimeout(() => {
      // Stale quote was cancelled by market maker before player could snipe it
      setActiveOpportunity(null);
      setVenueB({ ...venueA, venue: 'EXMATCH_LOCAL' });
      setLastSnipeLog(`MISSED: Rival market maker cancelled stale quote before execution (${cancelWindowMs}ms elapsed).`);
      setStats(prev => ({
        ...prev,
        streak: 0,
      }));
    }, cancelWindowMs);

    return () => clearTimeout(timer);
  }, [activeOpportunity, cancelWindowMs, venueA]);

  // Trigger Snipe
  const handleExecuteSnipe = () => {
    if (!activeOpportunity) return;

    const reactionTimeMs = performance.now() - oppDiscoveredTimeRef.current;
    const simulatedLatencyUs = Math.round(reactionTimeMs * 1000 + (Math.random() * 80));

    if (reactionTimeMs < cancelWindowMs) {
      // Successful Snipe!
      const profit = Number((activeOpportunity.priceDislocation * activeOpportunity.availableVolume).toFixed(2));
      audio.playSnipeSuccess();

      if (stats.streak > 2) {
        confetti({ particleCount: 50, spread: 50 });
      }

      setStats(prev => {
        const totalAttempts = prev.snipesAttempted + 1;
        const totalWins = prev.snipesSuccessful + 1;
        const totalAlpha = Number((prev.totalAlphaCaptured + profit).toFixed(2));
        const newScore = prev.score + Math.round(profit * 10) + (prev.streak * 25);
        const avgLat = Math.round((prev.avgLatencyUs * prev.snipesAttempted + simulatedLatencyUs) / totalAttempts);
        const bestLat = Math.min(prev.bestLatencyUs, simulatedLatencyUs);

        return {
          score: newScore,
          totalAlphaCaptured: totalAlpha,
          snipesAttempted: totalAttempts,
          snipesSuccessful: totalWins,
          winRate: Math.round((totalWins / totalAttempts) * 100),
          avgLatencyUs: avgLat,
          bestLatencyUs: bestLat,
          streak: prev.streak + 1,
        };
      });

      setLastSnipeLog(`SNIPE FILLED! Captured +$${profit.toFixed(2)} alpha @ ${simulatedLatencyUs}µs latency. Queue Rank: #1`);
      setActiveOpportunity(null);
      setVenueB({ ...venueA, venue: 'EXMATCH_LOCAL' });
    } else {
      audio.playAlert();
      setLastSnipeLog(`REJECTED: Tick-to-trade latency too high (${simulatedLatencyUs}µs). Stale order cancelled.`);
      setActiveOpportunity(null);
      setVenueB({ ...venueA, venue: 'EXMATCH_LOCAL' });
    }
  };

  // Keyboard Hotkey (Spacebar to Snipe)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleExecuteSnipe();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOpportunity]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px 24px 16px' }}>
      {/* Top Controls & Difficulty Bar */}
      <div className="glass-panel" style={{
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Crosshair size={18} color="var(--color-cyan)" />
          <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px' }}>
            LATENCY ARBITRAGE & SNIPING ARENA
          </span>
        </div>

        {/* Difficulty Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>LATENCY PROFILE:</span>
          {(['NORMAL', 'HFT_PRO', 'ULTRA_FAST'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              style={{
                background: difficulty === d ? 'rgba(0, 229, 255, 0.2)' : 'var(--bg-secondary)',
                color: difficulty === d ? 'var(--color-cyan)' : 'var(--text-secondary)',
                border: `1px solid ${difficulty === d ? 'var(--color-cyan)' : 'var(--border-subtle)'}`,
                padding: '5px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {d === 'NORMAL' ? 'Standard (1.2s)' : d === 'HFT_PRO' ? 'Fast (700ms)' : 'Ultra (400ms)'}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Performance Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-cyan)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL ALPHA</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-bid)', marginTop: '4px' }}>
            +${stats.totalAlphaCaptured.toFixed(2)}
          </div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Score: {stats.score.toLocaleString()} pts
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-bid)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SNIPING ACCURACY</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.winRate}%
          </div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {stats.snipesSuccessful} / {stats.snipesAttempted} attempts
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-amber)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AVG LATENCY</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-amber)', marginTop: '4px' }}>
            {stats.avgLatencyUs > 0 ? `${stats.avgLatencyUs}µs` : '--'}
          </div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Best: {stats.bestLatencyUs < 9999 ? `${stats.bestLatencyUs}µs` : '--'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px', borderLeft: '3px solid var(--color-purple)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WIN STREAK</div>
          <div className="mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-purple)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {stats.streak}x {stats.streak >= 3 && <Flame size={16} color="var(--color-ask)" />}
          </div>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Opps Generated: {opportunityCount}
          </div>
        </div>
      </div>

      {/* Dual Venue L2 Price Feed Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Venue A: Primary External Fast Feed */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="var(--color-amber)" />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>VENUE A: PRIMARY FAST FEED</span>
            </div>
            <span className="mono" style={{ fontSize: '10px', background: 'rgba(255, 183, 3, 0.15)', color: 'var(--color-amber)', padding: '2px 6px', borderRadius: '4px' }}>
              SOURCE OF TRUTH
            </span>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BEST BID</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-bid)', marginTop: '4px' }}>
                ${venueA.bestBid.toFixed(2)}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Size: {venueA.bidSize}</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BEST ASK</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-ask)', marginTop: '4px' }}>
                ${venueA.bestAsk.toFixed(2)}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Size: {venueA.askSize}</div>
            </div>
          </div>
        </div>

        {/* Venue B: ExMatch Local Exchange */}
        <div className="glass-panel" style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: activeOpportunity ? '1px solid var(--color-cyan)' : '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Crosshair size={15} color="var(--color-cyan)" />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>VENUE B: EXMATCH LOCAL ORDER BOOK</span>
            </div>
            <span className="mono" style={{ fontSize: '10px', background: 'rgba(0, 229, 255, 0.15)', color: 'var(--color-cyan)', padding: '2px 6px', borderRadius: '4px' }}>
              SNIPING TARGET
            </span>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BEST BID</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-bid)', marginTop: '4px' }}>
                ${venueB.bestBid.toFixed(2)}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Size: {venueB.bidSize}</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BEST ASK</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-ask)', marginTop: '4px' }}>
                ${venueB.bestAsk.toFixed(2)}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Size: {venueB.askSize}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ARBITRAGE TRIGGER / SNIPING RADAR */}
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: activeOpportunity ? 'linear-gradient(135deg, rgba(0, 229, 255, 0.12), rgba(0, 245, 155, 0.08))' : 'var(--bg-card)',
        border: activeOpportunity ? '2px solid var(--color-cyan)' : '1px solid var(--border-subtle)',
        boxShadow: activeOpportunity ? '0 0 25px rgba(0, 229, 255, 0.25)' : 'none',
        transition: 'all 0.15s ease',
      }}>
        {activeOpportunity ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-cyan)' }}>
              <Sparkles size={20} />
              <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>
                LEAD-LAG ARBITRAGE DETECTED!
              </span>
            </div>

            <div className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)', textAlign: 'center' }}>
              {activeOpportunity.type === 'BUY_LOCAL_SELL_PRIMARY' ? (
                <span>
                  Primary surged to <strong style={{ color: 'var(--color-bid)' }}>${activeOpportunity.primaryPrice.toFixed(2)}</strong> while ExMatch ask rests at <strong style={{ color: 'var(--color-ask)' }}>${activeOpportunity.localPrice.toFixed(2)}</strong>!
                </span>
              ) : (
                <span>
                  Primary crashed to <strong style={{ color: 'var(--color-ask)' }}>${activeOpportunity.primaryPrice.toFixed(2)}</strong> while ExMatch bid rests at <strong style={{ color: 'var(--color-bid)' }}>${activeOpportunity.localPrice.toFixed(2)}</strong>!
                </span>
              )}
            </div>

            <div className="mono" style={{
              background: 'rgba(0,0,0,0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
            }}>
              <div>SPREAD: <strong style={{ color: 'var(--color-cyan)' }}>+${activeOpportunity.priceDislocation.toFixed(2)}/sh</strong></div>
              <div>VOL: <strong>{activeOpportunity.availableVolume} sh</strong></div>
              <div>MAX PROFIT: <strong style={{ color: 'var(--color-bid)' }}>+${(activeOpportunity.priceDislocation * activeOpportunity.availableVolume).toFixed(2)}</strong></div>
            </div>

            <button
              onClick={handleExecuteSnipe}
              style={{
                background: 'linear-gradient(135deg, #00e5ff, #00f59b)',
                border: 'none',
                color: '#000',
                padding: '14px 40px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 900,
                letterSpacing: '1px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)',
                transform: 'scale(1.03)',
                transition: 'all 0.1s ease',
              }}
            >
              <Crosshair size={18} />
              SNIPE IOC NOW [SPACE]
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <Timer size={24} />
            <div style={{ fontSize: '13px', fontWeight: 600 }}>SCANNING VENUES FOR PRICE DISLOCATIONS...</div>
            <div style={{ fontSize: '11px' }}>Press [SPACEBAR] or click to fire IOC sniping orders when spread opens.</div>
          </div>
        )}
      </div>

      {/* Execution Log */}
      {lastSnipeLog && (
        <div className="glass-panel mono" style={{
          padding: '10px 14px',
          fontSize: '11px',
          color: lastSnipeLog.includes('FILLED') ? 'var(--color-bid)' : 'var(--text-muted)',
          borderLeft: `3px solid ${lastSnipeLog.includes('FILLED') ? 'var(--color-bid)' : 'var(--text-muted)'}`,
        }}>
          {lastSnipeLog}
        </div>
      )}
    </div>
  );
};
