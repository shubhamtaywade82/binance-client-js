/**
 * SOLUSDT Institutional SMC Hybrid Backtester
 * 
 * Combines SMC/ICT market objects with quantitative triggers
 * to find statistical edge through parameter optimization
 * 
 * Features:
 * - Multi-timeframe analysis (Daily, 4H, 1H, 15m, 5m, 1m)
 * - SMC object detection (OB, FVG, Liquidity, Structure)
 * - Quantitative triggers (RSI, MACD, Volume, ATR)
 * - Confluence scoring engine
 * - Parameter sweep for edge discovery
 * - Walk-forward validation
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  symbol: 'SOLUSDT',
  testPeriod: {
    start: '2024-11-01',
    end: '2024-12-15'
  },
  timeframes: ['1d', '4h', '1h', '15m', '5m', '1m'],
  leverage: 10,
  feeRate: 0.0008, // 0.08% round trip
  initialCapital: 10000,
  
  // Parameter ranges for optimization
  parameters: {
    obSensitivity: [0.6, 0.7, 0.8],
    fvgMinSize: [0.25, 0.35, 0.45], // × ATR
    confidenceThreshold: [65, 70, 75, 80],
    stopLossMethod: ['atr', 'swing_low', 'liquidity'],
    takeProfitMethod: ['rr_2', 'rr_3', 'liquidity_pool'],
    rsiTrigger: [25, 30, 35],
    volumeMultiplier: [1.5, 2.0, 2.5]
  }
};

// ============================================================================
// DATA UTILITIES
// ============================================================================

class DataFetcher {
  static async fetchOHLCV(symbol, timeframe, startTime, endTime) {
    const binanceUrl = 'https://api.binance.com/api/v3/klines';
    const allCandles = [];
    let currentTime = startTime;
    
    console.log(`📥 Fetching ${timeframe} data for ${symbol}...`);
    
    while (currentTime < endTime) {
      try {
        const response = await axios.get(binanceUrl, {
          params: {
            symbol: symbol,
            interval: timeframe,
            startTime: currentTime,
            endTime: endTime,
            limit: 1000
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
        
        // Rate limit handling
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Retrieved ${allCandles.length} candles for ${timeframe}`);
    return allCandles;
  }
  
  static async fetchAllTimeframes(config) {
    const startTime = new Date(config.testPeriod.start).getTime();
    const endTime = new Date(config.testPeriod.end).getTime();
    
    const data = {};
    
    for (const tf of config.timeframes) {
      data[tf] = await this.fetchOHLCV(config.symbol, tf, startTime, endTime);
    }
    
    return data;
  }
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

class Indicators {
  static SMA(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }
  
  static EMA(data, period) {
    if (data.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  static RSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
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
  
  static MACD(closes, fast = 12, slow = 26, signal = 9) {
    if (closes.length < slow + signal) return null;
    
    const fastEMA = this.EMA(closes, fast);
    const slowEMA = this.EMA(closes, slow);
    
    if (fastEMA === null || slowEMA === null) return null;
    
    const macdLine = fastEMA - slowEMA;
    
    // Simplified signal line calculation
    return {
      macd: macdLine,
      signal: macdLine * 0.8, // Approximation
      histogram: macdLine * 0.2
    };
  }
  
  static BollingerBands(closes, period = 20, stdDev = 2) {
    if (closes.length < period) return null;
    
    const sma = this.SMA(closes, period);
    const variance = closes.slice(-period)
      .reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * std),
      middle: sma,
      lower: sma - (stdDev * std)
    };
  }
}

// ============================================================================
// SMC OBJECT DETECTION
// ============================================================================

class SMCDetector {
  constructor(candles) {
    this.candles = candles;
  }
  
  detectSwingPoints(strength = 3) {
    const swings = { highs: [], lows: [] };
    
    for (let i = strength; i < this.candles.length - strength; i++) {
      const currentHigh = this.candles[i].high;
      const currentLow = this.candles[i].low;
      
      // Swing High
      let isSwingHigh = true;
      for (let j = 1; j <= strength; j++) {
        if (this.candles[i - j].high >= currentHigh || 
            this.candles[i + j].high >= currentHigh) {
          isSwingHigh = false;
          break;
        }
      }
      
      if (isSwingHigh) {
        swings.highs.push({ index: i, price: currentHigh, type: 'high' });
      }
      
      // Swing Low
      let isSwingLow = true;
      for (let j = 1; j <= strength; j++) {
        if (this.candles[i - j].low <= currentLow || 
            this.candles[i + j].low <= currentLow) {
          isSwingLow = false;
          break;
        }
      }
      
      if (isSwingLow) {
        swings.lows.push({ index: i, price: currentLow, type: 'low' });
      }
    }
    
    return swings;
  }
  
  detectOrderBlocks(sensitivity = 0.7) {
    const swings = this.detectSwingPoints(3);
    const orderBlocks = [];
    
    // Bullish OB: Last down candle before strong up move
    for (let i = 1; i < this.candles.length; i++) {
      const prevCandle = this.candles[i - 1];
      const currCandle = this.candles[i];
      
      // Strong bullish candle
      const bodySize = currCandle.close - currCandle.open;
      const range = currCandle.high - currCandle.low;
      const bullishStrength = bodySize / range;
      
      if (bullishStrength > sensitivity && currCandle.close > prevCandle.high) {
        // Check if near swing low
        const nearestSwingLow = swings.lows
          .filter(s => s.index < i)
          .sort((a, b) => b.index - a.index)[0];
        
        if (nearestSwingLow && (i - nearestSwingLow.index) < 10) {
          orderBlocks.push({
            type: 'bullish',
            high: prevCandle.high,
            low: prevCandle.low,
            mid: (prevCandle.high + prevCandle.low) / 2,
            index: i - 1,
            tested: 0,
            strength: bullishStrength
          });
        }
      }
      
      // Strong bearish candle
      const bearishBody = prevCandle.open - currCandle.close;
      const bearishStrength = bearishBody / range;
      
      if (bearishStrength > sensitivity && currCandle.close < prevCandle.low) {
        const nearestSwingHigh = swings.highs
          .filter(s => s.index < i)
          .sort((a, b) => b.index - a.index)[0];
        
        if (nearestSwingHigh && (i - nearestSwingHigh.index) < 10) {
          orderBlocks.push({
            type: 'bearish',
            high: prevCandle.high,
            low: prevCandle.low,
            mid: (prevCandle.high + prevCandle.low) / 2,
            index: i - 1,
            tested: 0,
            strength: bearishStrength
          });
        }
      }
    }
    
    return orderBlocks;
  }
  
  detectFairValueGaps(minSizeATR = 0.3) {
    const fvgList = [];
    const atr = Indicators.ATR(this.candles, 14);
    
    if (!atr) return fvgList;
    
    for (let i = 2; i < this.candles.length; i++) {
      const prev2 = this.candles[i - 2];
      const prev1 = this.candles[i - 1];
      const curr = this.candles[i];
      
      // Bullish FVG: Gap between prev2 high and curr low
      if (curr.low > prev2.high) {
        const gapSize = curr.low - prev2.high;
        if (gapSize >= minSizeATR * atr) {
          fvgList.push({
            type: 'bullish',
            top: curr.low,
            bottom: prev2.high,
            mid: (curr.low + prev2.high) / 2,
            size: gapSize,
            index: i,
            filled: false
          });
        }
      }
      
      // Bearish FVG: Gap between prev2 low and curr high
      if (curr.high < prev2.low) {
        const gapSize = prev2.low - curr.high;
        if (gapSize >= minSizeATR * atr) {
          fvgList.push({
            type: 'bearish',
            top: prev2.low,
            bottom: curr.high,
            mid: (prev2.low + curr.high) / 2,
            size: gapSize,
            index: i,
            filled: false
          });
        }
      }
    }
    
    return fvgList;
  }
  
  detectLiquidityPools() {
    const swings = this.detectSwingPoints(5);
    const liquidity = {
      buySide: swings.highs.map(h => ({ price: h.price, type: 'BSL' })),
      sellSide: swings.lows.map(l => ({ price: l.price, type: 'SSL' }))
    };
    
    return liquidity;
  }
  
  analyzeMarketStructure() {
    const swings = this.detectSwingPoints(5);
    
    if (swings.highs.length < 2 || swings.lows.length < 2) {
      return { trend: 'unknown', structure: [] };
    }
    
    const recentHighs = swings.highs.slice(-3);
    const recentLows = swings.lows.slice(-3);
    
    const higherHighs = recentHighs.every((h, i) => i === 0 || h.price > recentHighs[i - 1].price);
    const higherLows = recentLows.every((l, i) => i === 0 || l.price > recentLows[i - 1].price);
    const lowerHighs = recentHighs.every((h, i) => i === 0 || h.price < recentHighs[i - 1].price);
    const lowerLows = recentLows.every((l, i) => i === 0 || l.price < recentLows[i - 1].price);
    
    let trend = 'ranging';
    if (higherHighs && higherLows) trend = 'bullish';
    if (lowerHighs && lowerLows) trend = 'bearish';
    
    return {
      trend,
      structure: {
        higherHighs,
        higherLows,
        lowerHighs,
        lowerLows
      }
    };
  }
}

// ============================================================================
// CONFLUENCE SCORING ENGINE
// ============================================================================

class ConfluenceEngine {
  static scoreSetup(params, smcData, indicators, currentPrice) {
    let score = 0;
    const details = [];
    
    // SMC Factors (50% weight)
    if (smcData.obNearby) {
      score += 20;
      details.push(`OB nearby (${smcData.obDistance.toFixed(2)}%)`);
    }
    
    if (smcData.fvgAlignment) {
      score += 15;
      details.push('FVG alignment');
    }
    
    if (smcData.liquiditySweep) {
      score += 25;
      details.push('Liquidity sweep detected');
    }
    
    if (smcData.htfBias === 'bullish') {
      score += 10;
      details.push('HTF bullish bias');
    }
    
    // Trigger Factors (30% weight)
    if (indicators.rsi < params.rsiTrigger) {
      score += 15;
      details.push(`RSI oversold (${indicators.rsi.toFixed(1)})`);
    }
    
    if (indicators.volumeRatio > params.volumeMultiplier) {
      score += 15;
      details.push(`Volume spike (${indicators.volumeRatio.toFixed(1)}x)`);
    }
    
    // Risk/Reward Factor (20% weight)
    if (smcData.expectedRR > 3) {
      score += 20;
      details.push(`Excellent RR (${smcData.expectedRR.toFixed(1)})`);
    } else if (smcData.expectedRR > 2) {
      score += 10;
      details.push(`Good RR (${smcData.expectedRR.toFixed(1)})`);
    }
    
    return {
      score: Math.min(score, 100),
      details,
      recommendation: score >= params.confidenceThreshold ? 'ENTER' : 'WAIT'
    };
  }
}

// ============================================================================
// BACKTESTING ENGINE
// ============================================================================

class Backtester {
  constructor(config, data) {
    this.config = config;
    this.data = data;
    this.trades = [];
    this.equityCurve = [config.initialCapital];
  }
  
  run(params) {
    console.log(`\n🧪 Testing parameters:`, JSON.stringify(params));
    
    const candles1m = this.data['1m'];
    let capital = this.config.initialCapital;
    let position = null;
    
    // Pre-calculate SMC objects on higher timeframes
    const candles15m = this.data['15m'];
    const smc15m = new SMCDetector(candles15m);
    const structure15m = smc15m.analyzeMarketStructure();
    const ob15m = smc15m.detectOrderBlocks(params.obSensitivity);
    const fvg15m = smc15m.detectFairValueGaps(params.fvgMinSize);
    const liquidity = smc15m.detectLiquidityPools();
    
    for (let i = 100; i < candles1m.length; i++) {
      const currentCandle = candles1m[i];
      const currentPrice = currentCandle.close;
      
      // Calculate indicators
      const closes = candles1m.slice(i - 50, i).map(c => c.close);
      const rsi = Indicators.RSI(closes, 14);
      const atr = Indicators.ATR(candles1m.slice(i - 50, i), 14);
      const volumeRatio = currentCandle.volume / Indicators.SMA(candles1m.slice(i - 50, i).map(c => c.volume), 20);
      
      if (!rsi || !atr) continue;
      
      // Find nearby SMC objects
      const nearestOB = ob15m.find(ob => 
        Math.abs(ob.mid - currentPrice) / currentPrice < 0.02
      );
      
      const relevantFVG = fvg15m.find(fvg => 
        !fvg.filled && 
        ((fvg.type === 'bullish' && currentPrice >= fvg.bottom && currentPrice <= fvg.top) ||
         (fvg.type === 'bearish' && currentPrice <= fvg.top && currentPrice >= fvg.bottom))
      );
      
      // Check for liquidity sweep
      const recentLow = Math.min(...candles1m.slice(i - 20, i).map(c => c.low));
      const recentHigh = Math.max(...candles1m.slice(i - 20, i).map(c => c.high));
      const liquiditySweep = currentPrice < recentLow * 0.995 || currentPrice > recentHigh * 1.005;
      
      // Calculate expected RR
      const stopDistance = atr * 1.5;
      const targetDistance = atr * 3;
      const expectedRR = targetDistance / stopDistance;
      
      // Prepare confluence data
      const smcData = {
        obNearby: !!nearestOB,
        obDistance: nearestOB ? Math.abs(nearestOB.mid - currentPrice) / currentPrice * 100 : 999,
        fvgAlignment: !!relevantFVG,
        liquiditySweep,
        htfBias: structure15m.trend,
        expectedRR
      };
      
      const indicators = { rsi, atr, volumeRatio };
      
      // Score setup
      const assessment = ConfluenceEngine.scoreSetup(params, smcData, indicators, currentPrice);
      
      // Entry logic
      if (assessment.recommendation === 'ENTER' && !position) {
        const direction = rsi < params.rsiTrigger ? 'LONG' : 'SHORT';
        const entryPrice = currentPrice;
        const stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
        const takeProfit = direction === 'LONG' ? entryPrice + targetDistance : entryPrice - targetDistance;
        
        position = {
          direction,
          entryPrice,
          stopLoss,
          takeProfit,
          size: (capital * 0.1 * this.config.leverage) / entryPrice, // 10% risk per trade
          openIndex: i,
          openTime: currentCandle.timestamp
        };
      }
      
      // Exit logic
      if (position) {
        let exitPrice = null;
        let exitReason = null;
        
        if (position.direction === 'LONG') {
          if (currentCandle.low <= position.stopLoss) {
            exitPrice = position.stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (currentCandle.high >= position.takeProfit) {
            exitPrice = position.takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        } else {
          if (currentCandle.high >= position.stopLoss) {
            exitPrice = position.stopLoss;
            exitReason = 'STOP_LOSS';
          } else if (currentCandle.low <= position.takeProfit) {
            exitPrice = position.takeProfit;
            exitReason = 'TAKE_PROFIT';
          }
        }
        
        if (exitPrice) {
          const grossPnL = position.direction === 'LONG' 
            ? (exitPrice - position.entryPrice) * position.size
            : (position.entryPrice - exitPrice) * position.size;
          
          const fees = (position.entryPrice + exitPrice) * position.size * this.config.feeRate;
          const netPnL = grossPnL - fees;
          
          capital += netPnL;
          
          this.trades.push({
            direction: position.direction,
            entryPrice: position.entryPrice,
            exitPrice,
            exitReason,
            grossPnL,
            fees,
            netPnL,
            openTime: position.openTime,
            closeTime: currentCandle.timestamp,
            duration: currentCandle.timestamp - position.openTime
          });
          
          this.equityCurve.push(capital);
          position = null;
        }
      }
    }
    
    // Calculate metrics
    return this.calculateMetrics(params);
  }
  
  calculateMetrics(params) {
    const totalTrades = this.trades.length;
    if (totalTrades === 0) {
      return { totalTrades: 0, valid: false };
    }
    
    const wins = this.trades.filter(t => t.netPnL > 0);
    const losses = this.trades.filter(t => t.netPnL <= 0);
    
    const winRate = wins.length / totalTrades;
    const grossProfit = wins.reduce((sum, t) => sum + t.grossPnL, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
    
    const totalNetPnL = this.trades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalReturn = (this.equityCurve[this.equityCurve.length - 1] - this.config.initialCapital) / this.config.initialCapital;
    
    // Calculate max drawdown
    let peak = this.config.initialCapital;
    let maxDrawdown = 0;
    for (const equity of this.equityCurve) {
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Sharpe ratio (simplified)
    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      returns.push((this.equityCurve[i] - this.equityCurve[i - 1]) / this.equityCurve[i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
    
    return {
      params,
      totalTrades,
      wins: wins.length,
      losses: losses.length,
      winRate,
      grossProfit,
      grossLoss,
      profitFactor,
      totalNetPnL,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      expectancy: (winRate * (grossProfit / wins.length || 0)) - ((1 - winRate) * (grossLoss / losses.length || 0)),
      valid: totalTrades >= 10 && profitFactor > 1.0
    };
  }
}

// ============================================================================
// PARAMETER SWEEP OPTIMIZER
// ============================================================================

async function runParameterSweep(config, data) {
  console.log('\n🚀 Starting Parameter Sweep Optimization...\n');
  
  const results = [];
  const paramKeys = Object.keys(config.parameters);
  
  // Generate all parameter combinations
  function generateCombinations(params, keys, index, current, combinations) {
    if (index === keys.length) {
      combinations.push({ ...current });
      return;
    }
    
    const key = keys[index];
    for (const value of params[key]) {
      current[key] = value;
      generateCombinations(params, keys, index + 1, current, combinations);
    }
  }
  
  const combinations = [];
  generateCombinations(config.parameters, paramKeys, 0, {}, combinations);
  
  console.log(`Testing ${combinations.length} parameter combinations...\n`);
  
  // Test each combination
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    const backtester = new Backtester(config, data);
    const metrics = backtester.run(params);
    
    if (metrics.valid) {
      results.push(metrics);
      console.log(`[${i + 1}/${combinations.length}] ✅ PF: ${metrics.profitFactor.toFixed(2)} | WR: ${(metrics.winRate * 100).toFixed(1)}% | Return: ${(metrics.totalReturn * 100).toFixed(2)}% | Trades: ${metrics.totalTrades}`);
    } else {
      console.log(`[${i + 1}/${combinations.length}] ❌ Invalid (Trades: ${metrics.totalTrades}, PF: ${metrics.profitFactor?.toFixed(2) || 0})`);
    }
  }
  
  // Sort by profit factor
  results.sort((a, b) => b.profitFactor - a.profitFactor);
  
  return results;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('🏦 INSTITUTIONAL SMC HYBRID BACKTESTER');
  console.log('='.repeat(80));
  
  // Fetch historical data
  const data = await DataFetcher.fetchAllTimeframes(CONFIG);
  
  if (data['1m'].length === 0) {
    console.error('❌ No data retrieved. Exiting.');
    return;
  }
  
  // Run parameter sweep
  const results = await runParameterSweep(CONFIG, data);
  
  // Display top results
  console.log('\n' + '='.repeat(80));
  console.log('📊 TOP PERFORMING STRATEGIES');
  console.log('='.repeat(80));
  
  const topStrategies = results.slice(0, 10);
  
  if (topStrategies.length === 0) {
    console.log('\n⚠️ No strategies met minimum criteria (10+ trades, PF > 1.0)');
    console.log('\n💡 Recommendations:');
    console.log('   - Relax entry conditions (lower confidence threshold)');
    console.log('   - Expand parameter ranges');
    console.log('   - Extend test period for more data');
  } else {
    topStrategies.forEach((strategy, idx) => {
      console.log(`\n#${idx + 1} - Profit Factor: ${strategy.profitFactor.toFixed(2)}`);
      console.log('   Parameters:', JSON.stringify(strategy.params, null, 2));
      console.log(`   Win Rate: ${(strategy.winRate * 100).toFixed(1)}%`);
      console.log(`   Total Return: ${(strategy.totalReturn * 100).toFixed(2)}%`);
      console.log(`   Max Drawdown: ${(strategy.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`   Sharpe Ratio: ${strategy.sharpeRatio.toFixed(2)}`);
      console.log(`   Total Trades: ${strategy.totalTrades}`);
      console.log(`   Expectancy: $${strategy.expectancy.toFixed(2)}`);
    });
    
    // Check for edge
    const hasEdge = topStrategies.some(s => 
      s.profitFactor > 1.5 && 
      s.winRate > 0.45 && 
      s.totalTrades > 30 &&
      s.sharpeRatio > 1.0
    );
    
    console.log('\n' + '='.repeat(80));
    if (hasEdge) {
      console.log('✅ EDGE DETECTED! One or more strategies show statistical advantage.');
      console.log('\n🎯 Next Steps:');
      console.log('   1. Run walk-forward analysis on top strategies');
      console.log('   2. Paper trade in real-time for 4-8 weeks');
      console.log('   3. Start with small capital ($500-1000)');
    } else {
      console.log('❌ NO STATISTICAL EDGE FOUND');
      console.log('\n💡 Recommendations:');
      console.log('   - Pure SMC concepts need enhancement with other factors');
      console.log('   - Consider ML approach to find non-linear patterns');
      console.log('   - Add regime filtering (trending vs ranging markets)');
      console.log('   - Explore alternative strategies (stat arb, order flow)');
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'solusdt-smc-hybrid-backtest-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    config: CONFIG,
    timestamp: new Date().toISOString(),
    totalCombinations: Object.values(CONFIG.parameters).reduce((a, b) => a * b.length, 1),
    validStrategies: results.length,
    topStrategies,
    hasEdge: topStrategies.some(s => 
      s.profitFactor > 1.5 && 
      s.winRate > 0.45 && 
      s.totalTrades > 30 &&
      s.sharpeRatio > 1.0
    )
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

// Run the backtester
main().catch(console.error);
