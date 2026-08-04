/**
 * SOLUSDT SMC Hybrid Backtester - Fast Edition
 * 
 * Optimized for quick edge discovery with focused parameter ranges
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  symbol: 'SOLUSDT',
  testPeriod: {
    start: '2024-11-01',
    end: '2024-12-15'
  },
  leverage: 10,
  feeRate: 0.0008,
  initialCapital: 10000,
  
  // Focused parameters for faster testing
  parameters: {
    confidenceThreshold: [70, 75, 80],
    rsiTrigger: [30, 35],
    volumeMultiplier: [2.0, 2.5],
    useLiquiditySweep: [true, false],
    useHTFBias: [true, false]
  }
};

class DataFetcher {
  static async fetchOHLCV(symbol, timeframe, startTime, endTime) {
    const binanceUrl = 'https://api.binance.com/api/v3/klines';
    const allCandles = [];
    let currentTime = startTime;
    
    while (currentTime < endTime) {
      try {
        const response = await axios.get(binanceUrl, {
          params: {
            symbol, interval: timeframe,
            startTime: currentTime, endTime, limit: 1000
          }
        });
        
        if (response.data.length === 0) break;
        
        const candles = response.data.map(c => ({
          timestamp: c[0],
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5])
        }));
        
        allCandles.push(...candles);
        currentTime = candles[candles.length - 1].timestamp + 1;
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return allCandles;
  }
  
  static async fetchAllTimeframes(config) {
    const startTime = new Date(config.testPeriod.start).getTime();
    const endTime = new Date(config.testPeriod.end).getTime();
    
    console.log('📥 Fetching multi-timeframe data...');
    const data = {};
    
    // Only fetch necessary timeframes
    data['1m'] = await this.fetchOHLCV(config.symbol, '1m', startTime, endTime);
    data['15m'] = await this.fetchOHLCV(config.symbol, '15m', startTime, endTime);
    
    console.log(`✅ 1m: ${data['1m'].length} candles, 15m: ${data['15m'].length} candles`);
    return data;
  }
}

class Indicators {
  static RSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    
    return 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  static ATR(candles, period = 14) {
    if (candles.length < period + 1) return null;
    
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      trs.push(Math.max(hl, hc, lc));
    }
    
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
  
  static SMA(data, period) {
    if (data.length < period) return null;
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
}

class SMCDetector {
  constructor(candles) {
    this.candles = candles;
  }
  
  detectSwingPoints(strength = 3) {
    const swings = { highs: [], lows: [] };
    
    for (let i = strength; i < this.candles.length - strength; i++) {
      const currentHigh = this.candles[i].high;
      const currentLow = this.candles[i].low;
      
      let isSwingHigh = true;
      for (let j = 1; j <= strength; j++) {
        if (this.candles[i - j].high >= currentHigh || 
            this.candles[i + j].high >= currentHigh) {
          isSwingHigh = false;
          break;
        }
      }
      if (isSwingHigh) swings.highs.push({ index: i, price: currentHigh });
      
      let isSwingLow = true;
      for (let j = 1; j <= strength; j++) {
        if (this.candles[i - j].low <= currentLow || 
            this.candles[i + j].low <= currentLow) {
          isSwingLow = false;
          break;
        }
      }
      if (isSwingLow) swings.lows.push({ index: i, price: currentLow });
    }
    
    return swings;
  }
  
  analyzeMarketStructure() {
    const swings = this.detectSwingPoints(5);
    
    if (swings.highs.length < 2 || swings.lows.length < 2) {
      return { trend: 'unknown' };
    }
    
    const recentHighs = swings.highs.slice(-3);
    const recentLows = swings.lows.slice(-3);
    
    const higherHighs = recentHighs.every((h, i) => i === 0 || h.price > recentHighs[i - 1].price);
    const higherLows = recentLows.every((l, i) => i === 0 || l.price > recentLows[i - 1].price);
    const lowerHighs = recentHighs.every((h, i) => i === 0 || h.price < recentHighs[i - 1].price);
    const lowerLows = recentLows.every((l, i) => i === 0 || l.price < recentLows[i - 1].price);
    
    if (higherHighs && higherLows) return { trend: 'bullish' };
    if (lowerHighs && lowerLows) return { trend: 'bearish' };
    return { trend: 'ranging' };
  }
}

class Backtester {
  constructor(config, data) {
    this.config = config;
    this.data = data;
  }
  
  run(params) {
    const candles1m = this.data['1m'];
    const candles15m = this.data['15m'];
    
    let capital = this.config.initialCapital;
    const trades = [];
    let position = null;
    
    // Pre-calculate 15m structure
    const smc15m = new SMCDetector(candles15m);
    const structure15m = smc15m.analyzeMarketStructure();
    
    for (let i = 100; i < candles1m.length; i++) {
      const candle = candles1m[i];
      const price = candle.close;
      
      // Calculate indicators
      const closes = candles1m.slice(i - 50, i).map(c => c.close);
      const rsi = Indicators.RSI(closes, 14);
      const atr = Indicators.ATR(candles1m.slice(i - 50, i), 14);
      const volRatio = candle.volume / Indicators.SMA(candles1m.slice(i - 50, i).map(c => c.volume), 20);
      
      if (!rsi || !atr) continue;
      
      // Liquidity sweep detection
      const recentLow = Math.min(...candles1m.slice(i - 20, i).map(c => c.low));
      const recentHigh = Math.max(...candles1m.slice(i - 20, i).map(c => c.high));
      const sweep = candle.low < recentLow * 0.995 || candle.high > recentHigh * 1.005;
      
      // Confluence scoring - RELAXED for more signals
      let score = 0;
      
      // SMC factors (lighter weights)
      if (params.useLiquiditySweep && sweep) score += 15;
      if (params.useHTFBias && structure15m.trend === 'bullish') score += 10;
      if (params.useHTFBias && structure15m.trend === 'bearish') score -= 10;
      
      // Trigger factors (primary drivers)
      if (rsi < params.rsiTrigger) score += 30;
      if (volRatio > params.volumeMultiplier) score += 25;
      
      // RR factor
      const expectedRR = 2.0;
      if (expectedRR >= 2) score += 10;
      
      // Always enter on strong RSI signal even without SMC confluence
      const strongRSISignal = rsi < params.rsiTrigger;
      
      // Entry logic - relaxed to allow RSI-only signals
      if (!position && (score >= params.confidenceThreshold || strongRSISignal)) {
        const direction = rsi < params.rsiTrigger ? 'LONG' : 'SHORT';
        const stopDist = atr * 1.5;
        const targetDist = atr * 3.0;
        
        position = {
          direction,
          entry: price,
          stop: direction === 'LONG' ? price - stopDist : price + stopDist,
          target: direction === 'LONG' ? price + targetDist : price - targetDist,
          size: (capital * 0.1 * this.config.leverage) / price,
          openTime: candle.timestamp
        };
      }
      
      // Exit logic
      if (position) {
        let exitPrice = null;
        let exitReason = null;
        
        if (position.direction === 'LONG') {
          if (candle.low <= position.stop) {
            exitPrice = position.stop;
            exitReason = 'SL';
          } else if (candle.high >= position.target) {
            exitPrice = position.target;
            exitReason = 'TP';
          }
        } else {
          if (candle.high >= position.stop) {
            exitPrice = position.stop;
            exitReason = 'SL';
          } else if (candle.low <= position.target) {
            exitPrice = position.target;
            exitReason = 'TP';
          }
        }
        
        if (exitPrice) {
          const grossPnL = position.direction === 'LONG'
            ? (exitPrice - position.entry) * position.size
            : (position.entry - exitPrice) * position.size;
          
          const fees = (position.entry + exitPrice) * position.size * this.config.feeRate;
          const netPnL = grossPnL - fees;
          
          capital += netPnL;
          trades.push({
            direction: position.direction,
            entry: position.entry,
            exit: exitPrice,
            reason: exitReason,
            netPnL,
            duration: candle.timestamp - position.openTime
          });
          
          position = null;
        }
      }
    }
    
    // Calculate metrics
    if (trades.length === 0) return { totalTrades: 0, valid: false };
    
    const wins = trades.filter(t => t.netPnL > 0);
    const losses = trades.filter(t => t.netPnL <= 0);
    const winRate = wins.length / trades.length;
    const grossProfit = wins.reduce((sum, t) => sum + t.netPnL, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
    const totalReturn = (capital - this.config.initialCapital) / this.config.initialCapital;
    
    return {
      params,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      profitFactor,
      totalReturn,
      totalNetPnL: capital - this.config.initialCapital,
      avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      expectancy: (winRate * (grossProfit / wins.length || 0)) - ((1 - winRate) * (grossLoss / losses.length || 0)),
      valid: trades.length >= 10 && profitFactor > 1.0
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 SOLUSDT SMC HYBRID BACKTESTER - FAST EDITION');
  console.log('='.repeat(70));
  
  const data = await DataFetcher.fetchAllTimeframes(CONFIG);
  
  if (data['1m'].length === 0) {
    console.error('❌ No data retrieved');
    return;
  }
  
  // Generate parameter combinations
  const paramKeys = Object.keys(CONFIG.parameters);
  const combinations = [];
  
  function generate(keys, idx, current) {
    if (idx === keys.length) {
      combinations.push({ ...current });
      return;
    }
    for (const val of CONFIG.parameters[keys[idx]]) {
      current[keys[idx]] = val;
      generate(keys, idx + 1, current);
    }
  }
  
  generate(paramKeys, 0, {});
  
  console.log(`\n🧪 Testing ${combinations.length} parameter sets...\n`);
  
  const results = [];
  
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    const backtester = new Backtester(CONFIG, data);
    const metrics = backtester.run(params);
    
    if (metrics.valid) {
      results.push(metrics);
      const status = metrics.profitFactor > 1.5 ? '✅' : '⚠️';
      console.log(`[${i + 1}/${combinations.length}] ${status} PF: ${metrics.profitFactor.toFixed(2)} | WR: ${(metrics.winRate * 100).toFixed(1)}% | Return: ${(metrics.totalReturn * 100).toFixed(2)}% | Trades: ${metrics.totalTrades}`);
    } else {
      console.log(`[${i + 1}/${combinations.length}] ❌ Invalid (Trades: ${metrics.totalTrades}, PF: ${metrics.profitFactor?.toFixed(2) || 0})`);
    }
  }
  
  // Sort by profit factor
  results.sort((a, b) => b.profitFactor - a.profitFactor);
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 TOP RESULTS');
  console.log('='.repeat(70));
  
  if (results.length === 0) {
    console.log('\n⚠️ No strategies met minimum criteria');
  } else {
    results.slice(0, 5).forEach((r, idx) => {
      console.log(`\n#${idx + 1}: Profit Factor ${r.profitFactor.toFixed(2)}`);
      console.log(`   Params: Confidence=${r.params.confidenceThreshold}, RSI=${r.params.rsiTrigger}, Vol=${r.params.volumeMultiplier}x`);
      console.log(`   Sweep: ${r.params.useLiquiditySweep}, HTF Bias: ${r.params.useHTFBias}`);
      console.log(`   Win Rate: ${(r.winRate * 100).toFixed(1)}%, Trades: ${r.totalTrades}`);
      console.log(`   Return: ${(r.totalReturn * 100).toFixed(2)}%, Expectancy: $${r.expectancy.toFixed(2)}`);
    });
    
    const hasEdge = results.some(r => 
      r.profitFactor > 1.5 && r.winRate > 0.45 && r.totalTrades > 20
    );
    
    console.log('\n' + '='.repeat(70));
    if (hasEdge) {
      console.log('✅ POTENTIAL EDGE DETECTED!');
      console.log('   Next: Run walk-forward analysis and paper trading');
    } else {
      console.log('❌ NO STATISTICAL EDGE FOUND');
      console.log('   SMC concepts alone insufficient - need ML/hybrid approach');
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'smc-hybrid-fast-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTested: combinations.length,
    validStrategies: results.length,
    topResults: results.slice(0, 5),
    hasEdge: results.some(r => r.profitFactor > 1.5 && r.winRate > 0.45 && r.totalTrades > 20)
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

main().catch(console.error);
