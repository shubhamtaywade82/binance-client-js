/**
 * Institutional SMC + ICT + Price Action Strategy Engine
 * 
 * Philosophy: Convert descriptive concepts into deterministic market objects.
 * No retail checklists. Pure market microstructure modeling.
 * 
 * Features:
 * - Multi-timeframe hierarchy (Daily -> 1m)
 * - Stateful Market Objects (OB, FVG, Liquidity, etc.)
 * - Event-driven architecture
 * - Confidence-weighted decision engine
 * - Local memory paper trading (No API keys needed)
 */

const WebSocket = require('ws');

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================

const CONFIG = {
  symbol: 'SOLUSDT',
  leverage: 10,
  riskPerTrade: 0.01, // 1% of equity
  timeframes: ['1d', '4h', '1h', '15m', '5m', '1m'],
  wsUrl: 'wss://stream.binance.com:9443/ws',
  confidenceThresholds: {
    HIGH_CONVICTION: 95,
    STRONG: 90,
    GOOD: 80,
    MODERATE: 70,
    WEAK: 60,
    AVOID: 0
  },
  riskRules: {
    minRR: 2.0,
    maxStopATR: 2.0,
    minVolumeRatio: 1.2,
    avoidNewsWindow: 30 // minutes
  }
};

// ==========================================
// 2. DATA STRUCTURES & MARKET OBJECTS
// ==========================================

class MarketObject {
  constructor(type, timeframe, data) {
    this.id = `${type}_${timeframe}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type; // e.g., 'ORDER_BLOCK', 'FVG', 'LIQUIDITY_POOL'
    this.timeframe = timeframe;
    this.created = Date.now();
    this.updated = Date.now();
    this.state = 'ACTIVE'; // ACTIVE, TESTED, MITIGATED, INVALIDATED, EXPIRED
    this.priceZone = { high: data.high, low: data.low };
    this_strength = 100;
    this.confidence = 0;
    this.tests = 0;
    this.volumeProfile = { total: 0, buy: 0, sell: 0 };
    this.metadata = { ...data };
  }

  updateState(newState, reason) {
    this.state = newState;
    this.updated = Date.now();
    this.metadata.lastReason = reason;
  }

  addTest(price) {
    this.tests++;
    this.updated = Date.now();
    // Confidence decays with too many tests unless respected
    this.confidence = Math.max(0, this.confidence - (this.tests > 3 ? 15 : 0));
  }

  invalidate(reason) {
    this.updateState('INVALIDATED', reason);
    this.confidence = 0;
  }

  mitigate() {
    this.updateState('MITIGATED', 'Price entered zone and reacted');
    this.confidence = Math.min(100, this.confidence + 10);
  }
}

class MarketState {
  constructor() {
    this.objects = {
      orderBlocks: [],
      fairValueGaps: [],
      liquidityPools: [],
      breakerBlocks: [],
      mitigationBlocks: [],
      volumeImbalances: [],
      trendlines: [],
      channels: []
    };
    this.events = [];
    this.currentPrice = 0;
    this.timestamp = 0;
    this.bias = { daily: 'NEUTRAL', fourH: 'NEUTRAL', oneH: 'NEUTRAL' };
    this.structure = {
      daily: { type: 'RANGE', lastSwingHigh: 0, lastSwingLow: 0 },
      fourH: { type: 'RANGE', lastSwingHigh: 0, lastSwingLow: 0, bos: null, choch: null },
      oneH: { type: 'RANGE', lastSwingHigh: 0, lastSwingLow: 0 }
    };
    this.indicators = {
      vwap: {},
      atr: {},
      volumeProfile: {}
    };
  }

  addObject(obj) {
    const category = this.getCategory(obj.type);
    if (category) {
      // Remove expired objects older than 24h for performance
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      this.objects[category] = this.objects[category].filter(o => o.created > cutoff || o.state !== 'EXPIRED');
      this.objects[category].push(obj);
    }
  }

  getCategory(type) {
    if (type.includes('ORDER_BLOCK')) return 'orderBlocks';
    if (type.includes('FVG')) return 'fairValueGaps';
    if (type.includes('LIQUIDITY')) return 'liquidityPools';
    if (type.includes('BREAKER')) return 'breakerBlocks';
    if (type.includes('MITIGATION')) return 'mitigationBlocks';
    return null;
  }

  getActiveObjects(type, timeframe = null) {
    const category = this.getCategory(type);
    if (!category) return [];
    let objs = this.objects[category].filter(o => o.state === 'ACTIVE' || o.state === 'TESTED');
    if (timeframe) {
      objs = objs.filter(o => o.timeframe === timeframe);
    }
    return objs.sort((a, b) => b.confidence - a.confidence);
  }
}

// ==========================================
// 3. MARKET OBJECT DETECTION ENGINE
// ==========================================

class DetectionEngine {
  constructor(marketState) {
    this.state = marketState;
  }

  // Detect Swing Highs/Lows (Fractal based)
  detectSwings(candles, period = 5) {
    const swings = { highs: [], lows: [] };
    for (let i = period; i < candles.length - period; i++) {
      const current = candles[i];
      const prev = candles.slice(i - period, i);
      const next = candles.slice(i + 1, i + period);

      const isHigh = current.high > Math.max(...prev.map(c => c.high), ...next.map(c => c.high));
      const isLow = current.low < Math.min(...prev.map(c => c.low), ...next.map(c => c.low));

      if (isHigh) swings.highs.push({ price: current.high, time: current.time, index: i });
      if (isLow) swings.lows.push({ price: current.low, time: current.time, index: i });
    }
    return swings;
  }

  // Detect Fair Value Gaps (Imbalance)
  detectFVG(candles, timeframe) {
    const fvgList = [];
    for (let i = 2; i < candles.length; i++) {
      const curr = candles[i];
      const prev = candles[i - 1];
      const prev2 = candles[i - 2];

      // Bullish FVG: Low of current > High of candle 2 ago
      if (curr.low > prev2.high && (curr.close - curr.open) > (prev.close - prev.open) * 1.5) {
        const gapSize = curr.low - prev2.high;
        const obj = new MarketObject('FVG_BULLISH', timeframe, {
          high: curr.low,
          low: prev2.high,
          midpoint: (curr.low + prev2.high) / 2,
          size: gapSize,
          displacementCandle: curr
        });
        obj.confidence = Math.min(100, (gapSize / curr.open) * 10000); // Normalize by %
        fvgList.push(obj);
      }

      // Bearish FVG: High of current < Low of candle 2 ago
      if (curr.high < prev2.low && (prev.open - prev.close) > (curr.open - curr.close) * 1.5) {
        const gapSize = prev2.low - curr.high;
        const obj = new MarketObject('FVG_BEARISH', timeframe, {
          high: prev2.low,
          low: curr.high,
          midpoint: (prev2.low + curr.high) / 2,
          size: gapSize,
          displacementCandle: curr
        });
        obj.confidence = Math.min(100, (gapSize / curr.open) * 10000);
        fvgList.push(obj);
      }
    }
    return fvgList;
  }

  // Detect Order Blocks (Last opposite candle before displacement)
  detectOrderBlocks(candles, swings, timeframe) {
    const obList = [];
    // Simple heuristic: Candle before a strong move that broke structure
    for (let i = 1; i < candles.length - 5; i++) {
      const curr = candles[i];
      const nextFive = candles.slice(i + 1, i + 6);
      const maxNext = Math.max(...nextFive.map(c => c.high));
      const minNext = Math.min(...nextFive.map(c => c.low));

      // Bullish OB: Bearish candle followed by strong bullish expansion
      if (curr.close < curr.open) {
        const expansion = (maxNext - curr.low) / curr.open;
        if (expansion > 0.005) { // 0.5% move
          const obj = new MarketObject('OB_BULLISH', timeframe, {
            high: curr.open,
            low: curr.close,
            midpoint: (curr.open + curr.close) / 2,
            expansionSize: expansion
          });
          obj.confidence = Math.min(100, expansion * 5000);
          obList.push(obj);
        }
      }

      // Bearish OB: Bullish candle followed by strong bearish expansion
      if (curr.close > curr.open) {
        const expansion = (curr.high - minNext) / curr.open;
        if (expansion > 0.005) {
          const obj = new MarketObject('OB_BEARISH', timeframe, {
            high: curr.close,
            low: curr.open,
            midpoint: (curr.close + curr.open) / 2,
            expansionSize: expansion
          });
          obj.confidence = Math.min(100, expansion * 5000);
          obList.push(obj);
        }
      }
    }
    return obList;
  }

  // Detect Liquidity Pools (Equal Highs/Lows, Swing Points)
  detectLiquidity(candles, swings, timeframe) {
    const pools = [];
    
    // Add Swing Highs/Lows as liquidity
    swings.highs.forEach(s => {
      const obj = new MarketObject('LIQUIDITY_BUY_SIDE', timeframe, {
        price: s.price,
        type: 'SWING_HIGH',
        time: s.time
      });
      obj.confidence = 80; // Default confidence for swing points
      pools.push(obj);
    });

    swings.lows.forEach(s => {
      const obj = new MarketObject('LIQUIDITY_SELL_SIDE', timeframe, {
        price: s.price,
        type: 'SWING_LOW',
        time: s.time
      });
      obj.confidence = 80;
      pools.push(obj);
    });

    // Detect Equal Highs/Lows (Double/Triple tops/bottoms)
    // Simplified: Check for clusters within 0.5%
    const clusterHighs = this.clusterPrices(swings.highs.map(s => s.price), 0.005);
    clusterHighs.forEach(cluster => {
      const obj = new MarketObject('LIQUIDITY_BUY_SIDE', timeframe, {
        price: cluster.avg,
        type: 'EQUAL_HIGHS',
        count: cluster.count
      });
      obj.confidence = Math.min(100, 70 + (cluster.count * 10));
      pools.push(obj);
    });

    return pools;
  }

  clusterPrices(prices, tolerance) {
    const clusters = [];
    prices.forEach(price => {
      let found = false;
      for (let c of clusters) {
        if (Math.abs(c.avg - price) / c.avg <= tolerance) {
          c.prices.push(price);
          c.avg = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
          c.count++;
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({ prices: [price], avg: price, count: 1 });
      }
    });
    return clusters.filter(c => c.count >= 2);
  }

  // Detect Market Structure Shift (CHOCH/BOS)
  detectStructureShift(candles, prevStructure, timeframe) {
    const swings = this.detectSwings(candles, 5);
    if (swings.highs.length === 0 || swings.lows.length === 0) return null;

    const lastHigh = swings.highs[swings.highs.length - 1].price;
    const lastLow = swings.lows[swings.lows.length - 1].price;
    const prevHigh = swings.highs.length > 1 ? swings.highs[swings.highs.length - 2].price : prevStructure.lastSwingHigh;
    const prevLow = swings.lows.length > 1 ? swings.lows[swings.lows.length - 2].price : prevStructure.lastSwingLow;

    let type = prevStructure.type;
    let event = null;

    // Bullish BOS: Break of previous high in uptrend
    if (lastHigh > prevHigh && prevStructure.type === 'BULLISH') {
      event = { type: 'BOS_BULLISH', price: lastHigh, time: Date.now() };
    }
    // Bearish BOS: Break of previous low in downtrend
    else if (lastLow < prevLow && prevStructure.type === 'BEARISH') {
      event = { type: 'BOS_BEARISH', price: lastLow, time: Date.now() };
    }
    // CHOCH: Change of character (Trend reversal)
    else if (lastHigh > prevHigh && prevStructure.type === 'BEARISH') {
      type = 'BULLISH';
      event = { type: 'CHOCH_BULLISH', price: lastHigh, time: Date.now() };
    }
    else if (lastLow < prevLow && prevStructure.type === 'BULLISH') {
      type = 'BEARISH';
      event = { type: 'CHOCH_BEARISH', price: lastLow, time: Date.now() };
    }

    return {
      type,
      lastSwingHigh: lastHigh,
      lastSwingLow: lastLow,
      event
    };
  }

  // Detect Liquidity Sweep
  detectSweep(currentPrice, liquidityPools, candles) {
    const recentLow = Math.min(...candles.slice(-10).map(c => c.low));
    const recentHigh = Math.max(...candles.slice(-10).map(c => c.high));
    
    const sweeps = [];
    liquidityPools.forEach(pool => {
      if (pool.type.includes('SELL_SIDE') && recentLow < pool.priceZone.low && currentPrice > pool.priceZone.low) {
        sweeps.push({
          type: 'LIQUIDITY_SWEEP_SELL',
          price: pool.priceZone.low,
          time: Date.now(),
          magnitude: (pool.priceZone.low - recentLow) / pool.priceZone.low
        });
      }
      if (pool.type.includes('BUY_SIDE') && recentHigh > pool.priceZone.high && currentPrice < pool.priceZone.high) {
        sweeps.push({
          type: 'LIQUIDITY_SWEEP_BUY',
          price: pool.priceZone.high,
          time: Date.now(),
          magnitude: (recentHigh - pool.priceZone.high) / pool.priceZone.high
        });
      }
    });
    return sweeps;
  }
}

// ==========================================
// 4. CONFIDENCE & DECISION ENGINE
// ==========================================

class ConfidenceEngine {
  constructor(marketState) {
    this.state = marketState;
  }

  calculateScore(direction, timeframeContext) {
    let score = 50; // Base neutral
    const factors = [];

    // 1. HTF Bias Alignment (Daily/4H)
    const htfBias = this.state.bias.daily === direction.toUpperCase() ? 20 : 
                    (this.state.bias.daily === 'NEUTRAL' ? 5 : -20);
    score += htfBias;
    factors.push({ name: 'HTF_Bias', value: htfBias, weight: 0.2 });

    // 2. Market Structure (4H/1H)
    const structAlign = this.state.structure.fourH.type === direction.toUpperCase() ? 15 : -15;
    score += structAlign;
    factors.push({ name: 'Structure_Align', value: structAlign, weight: 0.15 });

    // 3. Liquidity Sweep Confirmation
    const recentSweeps = this.state.events.filter(e => 
      e.time > Date.now() - (15 * 60 * 1000) && 
      ((direction === 'LONG' && e.type === 'LIQUIDITY_SWEEP_SELL') ||
       (direction === 'SHORT' && e.type === 'LIQUIDITY_SWEEP_BUY'))
    );
    const sweepScore = recentSweeps.length > 0 ? 20 : 0;
    score += sweepScore;
    factors.push({ name: 'Liquidity_Sweep', value: sweepScore, weight: 0.2 });

    // 4. FVG Confluence
    const fvgType = direction === 'LONG' ? 'FVG_BULLISH' : 'FVG_BEARISH';
    const activeFVGs = this.state.getActiveObjects(fvgType, '5m');
    const fvgScore = activeFVGs.length > 0 ? Math.min(20, activeFVGs[0].confidence * 0.2) : 0;
    score += fvgScore;
    factors.push({ name: 'FVG_Confluence', value: fvgScore, weight: 0.15 });

    // 5. Order Block Mitigation
    const obType = direction === 'LONG' ? 'OB_BULLISH' : 'OB_BEARISH';
    const activeOBs = this.state.getActiveObjects(obType, '5m');
    const obScore = activeOBs.length > 0 ? Math.min(15, activeOBs[0].confidence * 0.15) : 0;
    score += obScore;
    factors.push({ name: 'OB_Mitigation', value: obScore, weight: 0.15 });

    // 6. Volume Confirmation (Simulated)
    const volScore = 10; // Placeholder for real volume delta analysis
    score += volScore;
    factors.push({ name: 'Volume_Delta', value: volScore, weight: 0.1 });

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score),
      rating: this.getRating(score),
      factors
    };
  }

  getRating(score) {
    if (score >= CONFIG.confidenceThresholds.HIGH_CONVICTION) return 'HIGH_CONVICTION';
    if (score >= CONFIG.confidenceThresholds.STRONG) return 'STRONG';
    if (score >= CONFIG.confidenceThresholds.GOOD) return 'GOOD';
    if (score >= CONFIG.confidenceThresholds.MODERATE) return 'MODERATE';
    if (score >= CONFIG.confidenceThresholds.WEAK) return 'WEAK';
    return 'AVOID';
  }
}

// ==========================================
// 5. PAPER TRADING EXECUTION (LOCAL MEMORY)
// ==========================================

class PaperTrader {
  constructor(initialBalance = 10000) {
    this.balance = initialBalance;
    this.equity = initialBalance;
    this.position = null; // { type: 'LONG'|'SHORT', size: number, entry: number, sl: number, tp: number }
    this.trades = [];
    this.pnl = 0;
  }

  evaluateSignal(signal, currentPrice, atr) {
    if (signal.rating === 'AVOID' || signal.rating === 'WEAK') return null;
    if (this.position !== null) return null; // Already in trade

    // Risk Calculation
    const riskAmount = this.balance * CONFIG.riskPerTrade;
    const stopDistance = atr * CONFIG.riskRules.maxStopATR;
    
    let sl, tp;
    if (signal.direction === 'LONG') {
      sl = currentPrice - stopDistance;
      tp = currentPrice + (stopDistance * CONFIG.riskRules.minRR);
    } else {
      sl = currentPrice + stopDistance;
      tp = currentPrice - (stopDistance * CONFIG.riskRules.minRR);
    }

    const size = riskAmount / (Math.abs(sl - currentPrice));
    
    // Leverage check
    const notionalValue = size * currentPrice;
    const requiredMargin = notionalValue / CONFIG.leverage;
    
    if (requiredMargin > this.balance * 0.5) {
      console.log(`⚠️ Margin too high for ${signal.rating} signal. Skipping.`);
      return null;
    }

    return {
      direction: signal.direction,
      size: size,
      entry: currentPrice,
      sl: sl,
      tp: tp,
      risk: riskAmount,
      reward: riskAmount * CONFIG.riskRules.minRR,
      confidence: signal.score,
      reasoning: signal.reasoning
    };
  }

  execute(plan, currentPrice) {
    this.position = {
      type: plan.direction,
      size: plan.size,
      entry: plan.entry,
      sl: plan.sl,
      tp: plan.tp,
      openedAt: Date.now()
    };
    
    console.log(`\n🚀 EXECUTED ${plan.direction} | Size: ${plan.size.toFixed(4)} | Entry: ${plan.entry} | SL: ${plan.sl} | TP: ${plan.tp}`);
    console.log(`   Confidence: ${plan.confidence}/100 (${plan.rating})`);
    console.log(`   Risk: $${plan.risk.toFixed(2)} | Reward: $${plan.reward.toFixed(2)}`);
  }

  managePosition(currentPrice) {
    if (!this.position) return;

    const pos = this.position;
    let unrealizedPnl = 0;

    if (pos.type === 'LONG') {
      unrealizedPnl = (currentPrice - pos.entry) * pos.size;
      // Stop Loss Hit
      if (currentPrice <= pos.sl) {
        this.closePosition(currentPrice, 'STOP_LOSS');
        return;
      }
      // Take Profit Hit
      if (currentPrice >= pos.tp) {
        this.closePosition(currentPrice, 'TAKE_PROFIT');
        return;
      }
      // Move to Breakeven
      if (currentPrice >= pos.entry + (pos.tp - pos.entry) * 0.5) {
        pos.sl = Math.max(pos.sl, pos.entry); // Trail to BE
      }
    } else {
      unrealizedPnl = (pos.entry - currentPrice) * pos.size;
      // Stop Loss Hit
      if (currentPrice >= pos.sl) {
        this.closePosition(currentPrice, 'STOP_LOSS');
        return;
      }
      // Take Profit Hit
      if (currentPrice <= pos.tp) {
        this.closePosition(currentPrice, 'TAKE_PROFIT');
        return;
      }
      // Move to Breakeven
      if (currentPrice <= pos.entry - (pos.entry - pos.tp) * 0.5) {
        pos.sl = Math.min(pos.sl, pos.entry); // Trail to BE
      }
    }

    this.equity = this.balance + unrealizedPnl;
  }

  closePosition(price, reason) {
    const pos = this.position;
    let realizedPnl = 0;
    if (pos.type === 'LONG') {
      realizedPnl = (price - pos.entry) * pos.size;
    } else {
      realizedPnl = (pos.entry - price) * pos.size;
    }

    this.balance += realizedPnl;
    this.equity = this.balance;
    this.pnl += realizedPnl;

    this.trades.push({
      ...pos,
      exitPrice: price,
      exitTime: Date.now(),
      pnl: realizedPnl,
      reason: reason
    });

    console.log(`💰 CLOSED ${pos.type} | Reason: ${reason} | PnL: $${realizedPnl.toFixed(2)} | Balance: $${this.balance.toFixed(2)}`);
    this.position = null;
  }

  getStats() {
    const wins = this.trades.filter(t => t.pnl > 0).length;
    const losses = this.trades.filter(t => t.pnl <= 0).length;
    const totalPnl = this.trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = this.trades.length > 0 ? (wins / this.trades.length) * 100 : 0;
    
    return {
      totalTrades: this.trades.length,
      wins,
      losses,
      winRate: winRate.toFixed(2) + '%',
      totalPnl: totalPnl.toFixed(2),
      balance: this.balance.toFixed(2),
      roi: ((this.balance - 10000) / 10000 * 100).toFixed(2) + '%'
    };
  }
}

// ==========================================
// 6. MAIN ORCHESTRATOR
// ==========================================

class InstitutionalSMCEngine {
  constructor() {
    this.state = new MarketState();
    this.detector = new DetectionEngine(this.state);
    this.confidenceEngine = new ConfidenceEngine(this.state);
    this.trader = new PaperTrader(10000);
    this.candleStore = {}; // Map timeframe -> candles
    this.ws = null;
    this.running = false;
  }

  async start() {
    console.log('🏛️  Starting Institutional SMC Engine...');
    console.log(`   Symbol: ${CONFIG.symbol} | Leverage: ${CONFIG.leverage}x`);
    console.log(`   Timeframes: ${CONFIG.timeframes.join(', ')}`);
    console.log('   Mode: Paper Trading (Local Memory)\n');

    this.initializeWebSocket();
    
    // Status report every 5 minutes
    setInterval(() => this.reportStatus(), 300000);
  }

  initializeWebSocket() {
    const streams = CONFIG.timeframes.map(tf => 
      `${CONFIG.symbol.toLowerCase()}@kline_${tf}`
    ).join('/');

    const url = `${CONFIG.wsUrl}/${streams}`;
    console.log(`📡 Connecting to Binance WebSocket: ${url}`);
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('✅ Connected to Market Data Feed\n');
      this.running = true;
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.k) {
          this.processCandle(msg.k);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    this.ws.on('error', (err) => console.error('WS Error:', err));
    this.ws.on('close', () => {
      console.log('⚠️  WebSocket disconnected. Reconnecting...');
      setTimeout(() => this.initializeWebSocket(), 5000);
    });
  }

  processCandle(k) {
    const tf = k.i;
    const candle = {
      time: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v)
    };

    // Initialize store if needed
    if (!this.candleStore[tf]) this.candleStore[tf] = [];

    // Update or append candle
    const lastIdx = this.candleStore[tf].length - 1;
    if (lastIdx >= 0 && this.candleStore[tf][lastIdx].time === candle.time) {
      this.candleStore[tf][lastIdx] = candle; // Update closed candle
    } else {
      this.candleStore[tf].push(candle); // New candle
      if (this.candleStore[tf].length > 500) this.candleStore[tf].shift(); // Keep memory clean
    }

    this.state.currentPrice = candle.close;
    this.state.timestamp = candle.time;

    // Only process on candle close for strategy logic (approximate by checking if new candle)
    if (lastIdx < 0 || this.candleStore[tf][lastIdx].time !== candle.time) {
      this.runStrategyCycle(tf);
    }
  }

  runStrategyCycle(timeframe) {
    // We need sufficient data
    if (!this.candleStore['1d'] || this.candleStore['1d'].length < 50) return;
    if (!this.candleStore['5m'] || this.candleStore['5m'].length < 50) return;

    // 1. Update HTF Bias (Daily)
    const dailySwings = this.detector.detectSwings(this.candleStore['1d'], 5);
    const dailyStruct = this.detector.detectStructureShift(
      this.candleStore['1d'], 
      this.state.structure.daily, 
      '1d'
    );
    if (dailyStruct) {
      this.state.structure.daily = dailyStruct;
      this.state.bias.daily = dailyStruct.type;
      if (dailyStruct.event) this.state.events.push(dailyStruct.event);
    }

    // 2. Update 4H Structure
    const fourHSwings = this.detector.detectSwings(this.candleStore['4h'], 5);
    const fourHStruct = this.detector.detectStructureShift(
      this.candleStore['4h'],
      this.state.structure.fourH,
      '4h'
    );
    if (fourHStruct) {
      this.state.structure.fourH = fourHStruct;
      this.state.bias.fourH = fourHStruct.type;
      if (fourHStruct.event) this.state.events.push(fourHStruct.event);
    }

    // 3. Detect Market Objects on 5m (Execution Timeframe)
    const candles5m = this.candleStore['5m'];
    const swings5m = this.detector.detectSwings(candles5m, 5);
    
    // Clear old objects for this timeframe to avoid clutter (simplified)
    // In production, we would merge/update existing objects
    
    const fvgList = this.detector.detectFVG(candles5m, '5m');
    fvgList.forEach(obj => this.state.addObject(obj));

    const obList = this.detector.detectOrderBlocks(candles5m, swings5m, '5m');
    obList.forEach(obj => this.state.addObject(obj));

    const liqPools = this.detector.detectLiquidity(candles5m, swings5m, '5m');
    liqPools.forEach(obj => this.state.addObject(obj));

    // 4. Detect Events (Sweeps)
    const sweeps = this.detector.detectSweep(
      this.state.currentPrice, 
      this.state.getActiveObjects('LIQUIDITY'), 
      candles5m
    );
    sweeps.forEach(s => this.state.events.push(s));

    // 5. Generate Signals
    this.evaluateSignals();

    // 6. Manage Open Positions
    this.trader.managePosition(this.state.currentPrice);
  }

  evaluateSignals() {
    // Check LONG setup
    const longScore = this.confidenceEngine.calculateScore('LONG');
    if (longScore.rating !== 'AVOID' && longScore.rating !== 'WEAK') {
      const atr = this.calculateATR('5m', 14);
      const plan = this.trader.evaluateSignal(
        { direction: 'LONG', ...longScore, reasoning: this.generateReasoning('LONG', longScore) },
        this.state.currentPrice,
        atr
      );
      if (plan) this.trader.execute(plan, this.state.currentPrice);
    }

    // Check SHORT setup
    const shortScore = this.confidenceEngine.calculateScore('SHORT');
    if (shortScore.rating !== 'AVOID' && shortScore.rating !== 'WEAK') {
      const atr = this.calculateATR('5m', 14);
      const plan = this.trader.evaluateSignal(
        { direction: 'SHORT', ...shortScore, reasoning: this.generateReasoning('SHORT', shortScore) },
        this.state.currentPrice,
        atr
      );
      if (plan) this.trader.execute(plan, this.state.currentPrice);
    }
  }

  calculateATR(timeframe, period = 14) {
    const candles = this.candleStore[timeframe];
    if (!candles || candles.length < period + 1) return 0.01; // Default fallback
    
    let trSum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const curr = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      trSum += tr;
    }
    return trSum / period;
  }

  generateReasoning(direction, scoreData) {
    const factors = scoreData.factors.map(f => `${f.name}: ${f.value > 0 ? '+' : ''}${f.value}`).join(', ');
    return `Confidence ${scoreData.score}/100 (${scoreData.rating}). Factors: [${factors}]. HTF Bias: ${this.state.bias.daily}. Structure: ${this.state.structure.fourH.type}.`;
  }

  reportStatus() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 INSTITUTIONAL SMC ENGINE STATUS REPORT');
    console.log('='.repeat(60));
    console.log(`Current Price: ${this.state.currentPrice}`);
    console.log(`Market Bias: Daily=${this.state.bias.daily}, 4H=${this.state.bias.fourH}`);
    console.log(`Active Objects:`);
    console.log(`  - Order Blocks: ${this.state.getActiveObjects('OB').length}`);
    console.log(`  - FVGs: ${this.state.getActiveObjects('FVG').length}`);
    console.log(`  - Liquidity Pools: ${this.state.getActiveObjects('LIQUIDITY').length}`);
    console.log(`Recent Events: ${this.state.events.slice(-5).map(e => e.type).join(', ') || 'None'}`);
    
    const stats = this.trader.getStats();
    console.log(`\n📈 Trading Performance:`);
    console.log(`  - Total Trades: ${stats.totalTrades}`);
    console.log(`  - Win Rate: ${stats.winRate}`);
    console.log(`  - Total PnL: $${stats.totalPnl}`);
    console.log(`  - Current Balance: $${stats.balance}`);
    console.log(`  - ROI: ${stats.roi}`);
    console.log('='.repeat(60) + '\n');
  }
}

// ==========================================
// 7. ENTRY POINT
// ==========================================

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   INSTITUTIONAL SMC + ICT + PRICE ACTION STRATEGY         ║
║   Deterministic Market Object Modeling                    ║
║   No Retail Checklists | Pure Microstructure              ║
╚═══════════════════════════════════════════════════════════╝
`);

const engine = new InstitutionalSMCEngine();
engine.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Institutional SMC Engine...');
  const stats = engine.trader.getStats();
  console.log('\nFinal Statistics:', stats);
  process.exit(0);
});
