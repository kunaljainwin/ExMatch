# ExMatch HFT Quant Suite & Game Arena

A high-performance, dark-mode quantitative web suite and interactive high-frequency trading game built around the **ExMatch C++17 single-writer order matching engine**.

---

## 🌟 Modules & Features

### 1. The Market Maker Simulation (Avellaneda-Stoikov Model)
* **Interactive Level-2 Depth of Market (DOM)** ladder with dynamic depth bars, spread indicators, and 1-click limit buying/selling.
* **Avellaneda-Stoikov Quantitative Skew Assistant**:
  $$r(s, q, t) = s - q \cdot \gamma \cdot \sigma^2 \cdot (T - t)$$
  $$\delta_a + \delta_b = \frac{2}{\gamma} \ln\left(1 + \frac{\gamma}{\kappa}\right)$$
  Calculates reservation fair price $r$, dynamically shifting quotes lower when inventory $q > 0$ and higher when $q < 0$ to minimize inventory variance.
* **Multi-Agent Flow Simulation**: Noise retail traders, momentum trend followers, institutional iceberg orders, and toxic informed flow.
* **Game Modes**:
  * **Scalper Survival**: 60-second timed rounds to maximize Sharpe ratio and capture spread.
  * **Flash Crash Chaos**: Rapid liquidity drain and market sell cascades testing emergency flattening and risk aversion.
  * **Bot Arena**: Automatic quoting and algorithmic competition.
* **Keyboard Hotkeys**:
  * <kbd>Q</kbd>: Quote Avellaneda-Stoikov optimal spread
  * <kbd>F</kbd>: Panic Flatten (market sell/buy inventory to 0)
  * <kbd>C</kbd>: Cancel all resting player orders
  * <kbd>1</kbd> - <kbd>5</kbd>: Quick lot size selectors (5, 10, 25, 50, 100 shares)

---

### 2. Latency Arbitrage & Sniping Arena
* **Dual-Venue Feed Simulation**:
  * **Venue A (Primary Market)**: External macro price leader.
  * **Venue B (ExMatch Local)**: Local order book containing resting stale limit orders.
* **Lead-Lag Dislocation Detection**: Triggers when external price surges or crashes past local book bids/asks.
* **Microsecond Tick-to-Trade Simulation**: Simulates network jitter and queue priority.
* **Actionable Execution**: Hit <kbd>SPACEBAR</kbd> to transmit IOC (Immediate-Or-Cancel) sniping orders before rival market-maker cancel bots revoke stale quotes.
* **Telemetry**: Tracks accuracy percentage, total alpha captured, win streaks, and average execution latency ($\mu s$).

---

### 3. ExMatch Quant Terminal & Visual Stress-Tester
* **Professional Exchange Interface**:
  * Order Entry form supporting `LIMIT`, `MARKET`, `IOC`, `POST-ONLY`, and `FOK` orders.
  * Active Open Orders management with 1-click cancel.
  * Real-time 60 FPS HTML5 Canvas Micro-Tick Chart with dynamic price scaling.
  * Streaming Time & Sales (Trade Tape) with aggressor side indicators.
* **Core Stress-Tester & Chaos Profiler**:
  * Order burst injector generating 2,500 to 50,000 orders/sec.
  * Microsecond latency distribution metrics: $p50$, $p90$, $p99$, $p99.9$.
  * Real-time SPSC lock-free ring buffer utilization meter.
  * Monotonic 64-bit Write-Ahead Log (WAL) audit journal viewer.

---

## 🛠️ Technology Stack
* **Framework**: React 19 + TypeScript + Vite
* **Styling**: Vanilla CSS Quant Terminal System (`styles/theme.css`, Bloomberg dark aesthetics)
* **Audio**: Real-time synthesized Web Audio API sound effects (fills, ticks, alerts, snipes)
* **Testing**: Vitest unit test suite covering matching logic and quantitative models

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally in Development Mode
```bash
npm run dev
```

### 3. Run Unit Test Suite
```bash
npx vitest run
```

### 4. Production Build
```bash
npm run build
```
