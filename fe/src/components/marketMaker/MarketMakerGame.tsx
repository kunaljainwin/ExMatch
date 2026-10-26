import React, { useEffect, useRef, useState } from 'react';
import { MatchingEngine } from '../../engine/matchingEngine';
import { MarketBotSimulator } from '../../engine/marketBotSimulator';
import { calculateAvellanedaQuotes } from '../../engine/avellanedaModel';
import { DepthOfMarket } from './DepthOfMarket';
import { AvellanedaSkew } from './AvellanedaSkew';
import { PnLTelemetry } from './PnLTelemetry';
import { AvellanedaParams, MarketMakerMode, PlayerInventory } from '../../types/game';
import { OrderBookSnapshot, Trade } from '../../types/engine';
import { AlertTriangle, Bot, Flame, Play, RefreshCw, Square, Trophy, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audio } from '../../engine/audioService';

interface MarketMakerGameProps {
  engine: MatchingEngine;
  simulator: MarketBotSimulator;
  snapshot: OrderBookSnapshot;
  onRefresh: () => void;
}

export const MarketMakerGame: React.FC<MarketMakerGameProps> = ({
  engine,
  simulator,
  snapshot,
  onRefresh,
}) => {
  const [mode, setMode] = useState<MarketMakerMode>('SCALPER');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [roundTimeLeft, setRoundTimeLeft] = useState<number>(60);
  const [avellanedaParams, setAvellanedaParams] = useState<AvellanedaParams>({
    riskAversion: 0.15,
    volatility: 0.4,
    timeHorizon: 1.0,
    orderIntensity: 1.5,
  });

  const [inventory, setInventory] = useState<PlayerInventory>({
    position: 0,
    cash: 10000.0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
    volumeTraded: 0,
    totalTrades: 0,
    winningTrades: 0,
    maxDrawdown: 0,
    peakPnl: 0,
    averageEntryPrice: 0,
    sharpeRatio: 1.85,
  });

  // Calculate live Avellaneda-Stoikov model output
  const avellanedaOutput = calculateAvellanedaQuotes(
    snapshot.midPrice || 100.0,
    inventory.position,
    avellanedaParams
  );

  // Handle incoming trades affecting the player
  useEffect(() => {
    simulator.setOnTrade((trades: Trade[]) => {
      onRefresh();
      let updatedInv = { ...inventory };

      for (const trade of trades) {
        const isPlayerMaker = trade.makerOwner === 'PLAYER';
        const isPlayerTaker = trade.takerOwner === 'PLAYER';

        if (isPlayerMaker || isPlayerTaker) {
          audio.playFill();
          const side = isPlayerTaker ? trade.side : (trade.side === 'BUY' ? 'SELL' : 'BUY');
          const qty = trade.quantity;
          const price = trade.price;

          if (side === 'BUY') {
            const oldPos = updatedInv.position;
            const newPos = oldPos + qty;
            if (oldPos >= 0) {
              const oldCost = oldPos * updatedInv.averageEntryPrice;
              const newCost = qty * price;
              updatedInv.averageEntryPrice = newPos > 0 ? (oldCost + newCost) / newPos : 0;
            } else {
              // Closing short
              const closedQty = Math.min(Math.abs(oldPos), qty);
              const pnl = closedQty * (updatedInv.averageEntryPrice - price);
              updatedInv.realizedPnl += pnl;
              if (pnl > 0) updatedInv.winningTrades++;
            }
            updatedInv.position = newPos;
            updatedInv.cash -= qty * price;
          } else {
            // SELL
            const oldPos = updatedInv.position;
            const newPos = oldPos - qty;
            if (oldPos <= 0) {
              const oldCost = Math.abs(oldPos) * updatedInv.averageEntryPrice;
              const newCost = qty * price;
              updatedInv.averageEntryPrice = newPos < 0 ? (oldCost + newCost) / Math.abs(newPos) : 0;
            } else {
              // Closing long
              const closedQty = Math.min(oldPos, qty);
              const pnl = closedQty * (price - updatedInv.averageEntryPrice);
              updatedInv.realizedPnl += pnl;
              if (pnl > 0) updatedInv.winningTrades++;
            }
            updatedInv.position = newPos;
            updatedInv.cash += qty * price;
          }

          updatedInv.volumeTraded += qty;
          updatedInv.totalTrades++;
        }
      }

      // Mark-to-market unrealized PnL
      const mid = snapshot.midPrice || 100.0;
      if (updatedInv.position !== 0) {
        updatedInv.unrealizedPnl = updatedInv.position * (mid - updatedInv.averageEntryPrice);
      } else {
        updatedInv.unrealizedPnl = 0;
      }
      updatedInv.totalPnl = updatedInv.realizedPnl + updatedInv.unrealizedPnl;

      if (updatedInv.totalPnl > updatedInv.peakPnl) {
        updatedInv.peakPnl = updatedInv.totalPnl;
      }
      const dd = updatedInv.peakPnl - updatedInv.totalPnl;
      if (dd > updatedInv.maxDrawdown) {
        updatedInv.maxDrawdown = dd;
      }

      setInventory(updatedInv);
    });
  }, [inventory, snapshot.midPrice]);

  // Round countdown timer for Scalper Survival mode
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setRoundTimeLeft(prev => {
        if (prev <= 1) {
          if (inventory.totalPnl > 50) {
            confetti({ particleCount: 70, spread: 60 });
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, inventory.totalPnl]);

  // Global hotkeys (Q: Quote Spread, F: Flatten, C: Cancel All)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'q' || e.key === 'Q') {
        handleQuoteAvellanedaSpread();
      } else if (e.key === 'f' || e.key === 'F') {
        handleFlattenInventory();
      } else if (e.key === 'c' || e.key === 'C') {
        handleCancelAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [avellanedaOutput, inventory.position]);

  const handlePlaceLimitOrder = (side: 'BUY' | 'SELL', price: number, quantity: number) => {
    engine.submitOrder({
      side,
      price,
      quantity,
      type: 'LIMIT',
      owner: 'PLAYER',
    });
    onRefresh();
  };

  const handleCancelAll = () => {
    engine.cancelAllForOwner('PLAYER');
    onRefresh();
  };

  const handleFlattenInventory = () => {
    if (inventory.position === 0) return;
    const side = inventory.position > 0 ? 'SELL' : 'BUY';
    const quantity = Math.abs(inventory.position);

    engine.submitOrder({
      side,
      price: 0,
      quantity,
      type: 'MARKET',
      owner: 'PLAYER',
    });
    onRefresh();
  };

  const handleQuoteAvellanedaSpread = () => {
    // Cancel existing player quotes first
    engine.cancelAllForOwner('PLAYER');

    // Post both optimal bid and ask according to Avellaneda reservation formula
    engine.submitOrder({
      side: 'BUY',
      price: avellanedaOutput.optimalBid,
      quantity: 15,
      type: 'LIMIT',
      owner: 'PLAYER',
    });

    engine.submitOrder({
      side: 'SELL',
      price: avellanedaOutput.optimalAsk,
      quantity: 15,
      type: 'LIMIT',
      owner: 'PLAYER',
    });

    onRefresh();
  };

  const handleTriggerFlashCrash = () => {
    audio.playAlert();
    simulator.triggerFlashCrash();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px 24px 16px' }}>
      {/* Top Banner & Game Mode Bar */}
      <div className="glass-panel" style={{
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>GAME MODE:</span>
          {(['SCALPER', 'FLASH_CRASH', 'BOT_ARENA'] as MarketMakerMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? 'rgba(0, 229, 255, 0.2)' : 'var(--bg-secondary)',
                color: mode === m ? 'var(--color-cyan)' : 'var(--text-secondary)',
                border: `1px solid ${mode === m ? 'var(--color-cyan)' : 'var(--border-subtle)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {m === 'SCALPER' && <Flame size={13} color="var(--color-amber)" />}
              {m === 'FLASH_CRASH' && <AlertTriangle size={13} color="var(--color-ask)" />}
              {m === 'BOT_ARENA' && <Bot size={13} color="var(--color-bid)" />}
              {m.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Action Controls & Session Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {mode === 'FLASH_CRASH' && (
            <button
              onClick={handleTriggerFlashCrash}
              style={{
                background: 'rgba(255, 51, 102, 0.25)',
                border: '1px solid var(--color-ask)',
                color: 'var(--color-ask)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={14} />
              Inject Flash Shock
            </button>
          )}

          <div className="mono" style={{
            background: 'var(--bg-secondary)',
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: roundTimeLeft < 15 ? 'var(--color-ask)' : 'var(--text-secondary)',
            fontWeight: 700,
          }}>
            ROUND TIME: {roundTimeLeft}s
          </div>

          <button
            onClick={() => {
              if (isPlaying) {
                simulator.stop();
              } else {
                simulator.start();
              }
              setIsPlaying(!isPlaying);
            }}
            style={{
              background: isPlaying ? 'rgba(255, 183, 3, 0.15)' : 'rgba(0, 245, 155, 0.15)',
              border: `1px solid ${isPlaying ? 'var(--color-amber)' : 'var(--color-bid)'}`,
              color: isPlaying ? 'var(--color-amber)' : 'var(--color-bid)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isPlaying ? <Square size={13} /> : <Play size={13} />}
            {isPlaying ? 'PAUSE' : 'RESUME'}
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Cards */}
      <PnLTelemetry inventory={inventory} />

      {/* Main Game Interface: DOM Ladder + Avellaneda Quantitative Skew Assistant */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.3fr) minmax(280px, 1fr)', gap: '16px' }}>
        <DepthOfMarket
          snapshot={snapshot}
          avellaneda={avellanedaOutput}
          onPlaceLimitOrder={handlePlaceLimitOrder}
          onCancelAll={handleCancelAll}
          onFlattenInventory={handleFlattenInventory}
          onQuoteAvellanedaSpread={handleQuoteAvellanedaSpread}
          playerInventory={inventory.position}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AvellanedaSkew
            output={avellanedaOutput}
            params={avellanedaParams}
            onParamsChange={setAvellanedaParams}
            inventory={inventory.position}
            midPrice={snapshot.midPrice}
          />

          {/* Hotkey Quick Reference Card */}
          <div className="glass-panel" style={{ padding: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              KEYBOARD HOTKEYS:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }} className="mono">
              <div><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>Q</kbd> : Quote AS Spread</div>
              <div><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>F</kbd> : Flatten Position</div>
              <div><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>C</kbd> : Cancel All Quotes</div>
              <div><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>1-5</kbd> : Lot Size 5 to 100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
