import React, { useEffect, useRef, useState } from 'react';
import './styles/theme.css';
import { MatchingEngine } from './engine/matchingEngine';
import { MarketBotSimulator } from './engine/marketBotSimulator';
import { ActiveTab, Header } from './components/common/Header';
import { MarketMakerGame } from './components/marketMaker/MarketMakerGame';
import { LatencyArbGame } from './components/latencyArb/LatencyArbGame';
import { QuantTerminal } from './components/terminal/QuantTerminal';
import { ManualModal } from './components/common/ManualModal';
import { OrderBookSnapshot, Trade, WALEvent } from './types/engine';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('MARKET_MAKER');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Core Engine Instances
  const engineRef = useRef<MatchingEngine>(new MatchingEngine(100.0, 0.05));
  const simulatorRef = useRef<MarketBotSimulator>(new MarketBotSimulator(engineRef.current, 0.05));

  const [snapshot, setSnapshot] = useState<OrderBookSnapshot>(engineRef.current.getSnapshot());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [wal, setWal] = useState<WALEvent[]>([]);

  const handleRefresh = () => {
    setSnapshot(engineRef.current.getSnapshot());
    setWal([...engineRef.current.getWAL()]);
  };

  useEffect(() => {
    const sim = simulatorRef.current;
    sim.setOnTrade(newTrades => {
      setTrades(prev => [...prev.slice(-80), ...newTrades]);
      handleRefresh();
    });

    sim.start(140);
    handleRefresh();

    return () => {
      sim.stop();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sequenceId={engineRef.current.getSequenceId()}
        lastPrice={snapshot.lastTradePrice}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'MARKET_MAKER' && (
          <MarketMakerGame
            engine={engineRef.current}
            simulator={simulatorRef.current}
            snapshot={snapshot}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'LATENCY_ARB' && (
          <LatencyArbGame />
        )}

        {activeTab === 'TERMINAL_STRESS' && (
          <QuantTerminal
            engine={engineRef.current}
            snapshot={snapshot}
            trades={trades}
            wal={wal}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      <ManualModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

export default App;
