/**
 * SMC/ICT Strategy Backtester for SOLUSDT Futures
 * 
 * Tests Smart Money Concepts rigorously on historical data:
 * 1. Liquidity Sweeps + MSS (Market Structure Shift)
 * 2. FVG (Fair Value Gap) Entries
 * 3. Order Block Rejections
 * 4. Pure Price Action (Support/Resistance)
 * 
 * Outputs statistical edge analysis
 */

const axios = require('axios');

// --- CONFIGURATION ---
const CONFIG = {
    symbol: 'SOLUSDT',
    leverage: 10,
    initialBalance: 10000,
    riskPerTrade: 0.01,
    
    // Backtest Period
    startDate: '2024-01-01',
    endDate: '2024-12-01',
    interval: '5m',
    limit: 5000, // Max candles per request
    
    // Strategy Parameters
    fvgThreshold: 0.0005, // 0.05%
    sweepThreshold: 0.002, // 0.2%
    swingLookback: 10,
    
    // Fees
    takerFee: 0.0004,
    slippage: 0.0001,
};

// --- DATA STRUCTURES ---
class BacktestEngine {
    constructor() {
        this.candles = [];
        this.trades = [];
        this.balance = CONFIG.initialBalance;
        this.position = null;
        this.equityCurve = [];
        
        // SMC Structures
        this.swingsHigh = [];
        this.swingsLow = [];
        this.fvgBullish = [];
        this.fvgBearish = [];
    }

    async fetchData() {
        console.log(`📡 Fetching ${CONFIG.limit} candles for ${CONFIG.symbol}...`);
        
        // Fetch from Binance Public API
        const url = `https://api.binance.com/api/v3/klines?symbol=${CONFIG.symbol}&interval=${CONFIG.interval}&limit=${CONFIG.limit}`;
        
        try {
            const response = await axios.get(url);
            this.candles = response.data.map(d => ({
                time: d[0],
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));
            
            console.log(`✅ Loaded ${this.candles.length} candles`);
            console.log(`   From: ${new Date(this.candles[0].time).toISOString()}`);
            console.log(`   To:   ${new Date(this.candles[this.candles.length - 1].time).toISOString()}`);
        } catch (error) {
            console.error('❌ Failed to fetch data:', error.message);
            process.exit(1);
        }
    }

    identifySwings() {
        const lookback = CONFIG.swingLookback;
        this.swingsHigh = [];
        this.swingsLow = [];

        for (let i = lookback; i < this.candles.length - lookback; i++) {
            const current = this.candles[i];
            const left = this.candles.slice(i - lookback, i);
            const right = this.candles.slice(i + 1, i + lookback + 1);

            const maxLeft = Math.max(...left.map(c => c.high));
            const maxRight = Math.max(...right.map(c => c.high));
            const minLeft = Math.min(...left.map(c => c.low));
            const minRight = Math.min(...right.map(c => c.low));

            if (current.high > maxLeft && current.high > maxRight) {
                this.swingsHigh.push({ index: i, price: current.high, time: current.time });
            }
            if (current.low < minLeft && current.low < minRight) {
                this.swingsLow.push({ index: i, price: current.low, time: current.time });
            }
        }
    }

    identifyFVGs() {
        this.fvgBullish = [];
        this.fvgBearish = [];

        for (let i = 0; i < this.candles.length - 2; i++) {
            const c1 = this.candles[i];
            const c2 = this.candles[i + 1];
            const c3 = this.candles[i + 2];

            // Bullish FVG
            if (c3.low > c1.high) {
                const size = c3.low - c1.high;
                if (size > (c1.close * CONFIG.fvgThreshold)) {
                    this.fvgBullish.push({
                        index: i,
                        type: 'BULLISH',
                        top: c3.low,
                        bottom: c1.high,
                        size: size,
                        time: c1.time
                    });
                }
            }

            // Bearish FVG
            if (c3.high < c1.low) {
                const size = c1.low - c3.high;
                if (size > (c1.close * CONFIG.fvgThreshold)) {
                    this.fvgBearish.push({
                        index: i,
                        type: 'BEARISH',
                        top: c1.low,
                        bottom: c3.high,
                        size: size,
                        time: c1.time
                    });
                }
            }
        }
    }

    // Strategy 1: Liquidity Sweep + MSS + FVG (OPTIMIZED)
    runSMCStrategy() {
        console.log('\n🧪 Running SMC Strategy: Sweep + MSS + FVG (Optimized)...');
        
        let wins = 0;
        let losses = 0;
        let totalPnl = 0;
        
        // Add HTF bias filter - only trade in direction of higher timeframe trend
        const htfTrend = this.candles[this.candles.length - 1].close > this.candles[this.candles.length - 200]?.close ? 'BULLISH' : 'BEARISH';
        
        console.log(`   HTF Bias: ${htfTrend}`);

        for (let i = CONFIG.swingLookback * 2; i < this.candles.length - 10; i++) {
            const current = this.candles[i];
            
            // Find recent swings before this candle
            const recentHighs = this.swingsHigh.filter(s => s.index < i && s.index > i - 50);
            const recentLows = this.swingsLow.filter(s => s.index < i && s.index > i - 50);
            
            if (recentHighs.length === 0 || recentLows.length === 0) continue;
            
            const lastHigh = recentHighs[recentHighs.length - 1];
            const lastLow = recentLows[recentLows.length - 1];
            
            // Detect Sweep with tighter threshold
            const sweptLow = current.low < lastLow.price && 
                            (lastLow.price - current.low) > (lastLow.price * CONFIG.sweepThreshold * 0.8);
            
            const sweptHigh = current.high > lastHigh.price && 
                             (current.high - lastHigh.price) > (lastHigh.price * CONFIG.sweepThreshold * 0.8);
            
            // Find FVGs that formed right after the sweep (within 3 candles for faster reaction)
            const bullishFVGs = this.fvgBullish.filter(f => f.index > i && f.index <= i + 3);
            const bearishFVGs = this.fvgBearish.filter(f => f.index > i && f.index <= i + 3);
            
            // LONG SETUP - Only in bullish HTF bias
            if (htfTrend === 'BULLISH' && sweptLow && bullishFVGs.length > 0) {
                const fvg = bullishFVGs[0];
                const entry = current.close;
                const sl = fvg.bottom * 0.998; // Tighter SL
                const tp = entry + ((entry - sl) * 3); // 1:3 RR for better expectancy
                
                const result = this.simulateTrade('LONG', entry, sl, tp, i);
                if (result) {
                    totalPnl += result.pnl;
                    if (result.pnl > 0) wins++; else losses++;
                    this.trades.push(result);
                }
            }
            
            // SHORT SETUP - Only in bearish HTF bias
            if (htfTrend === 'BEARISH' && sweptHigh && bearishFVGs.length > 0) {
                const fvg = bearishFVGs[0];
                const entry = current.close;
                const sl = fvg.top * 1.002; // Tighter SL
                const tp = entry - ((sl - entry) * 3); // 1:3 RR
                
                const result = this.simulateTrade('SHORT', entry, sl, tp, i);
                if (result) {
                    totalPnl += result.pnl;
                    if (result.pnl > 0) wins++; else losses++;
                    this.trades.push(result);
                }
            }
        }
        
        return { wins, losses, totalPnl };
    }

    // Strategy 2: Order Block with Volume Confirmation (OPTIMIZED)
    runOrderBlockStrategy() {
        console.log('\n🧪 Running Order Block Strategy (with Volume Filter)...');
        
        let wins = 0;
        let losses = 0;
        let totalPnl = 0;
        let tradeCount = 0;
        
        // Calculate average volume for filtering
        const avgVolume = this.candles.slice(-50).reduce((sum, c) => sum + c.volume, 0) / 50;

        for (let i = 20; i < this.candles.length - 10; i++) {
            const c1 = this.candles[i-2];
            const c2 = this.candles[i-1];
            const c3 = this.candles[i];
            
            // Volume spike confirmation (1.5x average)
            const volumeSpike = c2.volume > (avgVolume * 1.5);
            
            // Bullish OB: Strong displacement up after a down candle WITH VOLUME
            if (c1.close < c1.open && // Down candle
                c2.close > c2.open && c2.close > c1.high && // Strong up
                c3.close > c3.open && // Continuation
                volumeSpike) { // Volume confirmation

                const entry = c3.close;
                const sl = c1.low * 0.998;
                const tp = entry + ((entry - sl) * 2.5); // 1:2.5 RR
                
                // Only take if we're in an uptrend (higher highs)
                if (i > 50 && this.candles[i].close > this.candles[i-50].close) {
                    const result = this.simulateTrade('LONG', entry, sl, tp, i);
                    if (result) {
                        totalPnl += result.pnl;
                        if (result.pnl > 0) wins++; else losses++;
                        this.trades.push(result);
                        tradeCount++;
                        if (tradeCount > 40) break; // Limit trades
                    }
                }
            }
            
            // Bearish OB: Strong displacement down after an up candle WITH VOLUME
            if (c1.close > c1.open && // Up candle
                c2.close < c2.open && c2.close < c1.low && // Strong down
                c3.close < c3.open && // Continuation
                volumeSpike) { // Volume confirmation

                const entry = c3.close;
                const sl = c1.high * 1.002;
                const tp = entry - ((sl - entry) * 2.5); // 1:2.5 RR
                
                // Only take if we're in a downtrend
                if (i > 50 && this.candles[i].close < this.candles[i-50].close) {
                    const result = this.simulateTrade('SHORT', entry, sl, tp, i);
                    if (result) {
                        totalPnl += result.pnl;
                        if (result.pnl > 0) wins++; else losses++;
                        this.trades.push(result);
                        tradeCount++;
                        if (tradeCount > 40) break;
                    }
                }
            }
        }
        
        return { wins, losses, totalPnl };
    }

    // Strategy 3: Price Action S/R with Confluence (OPTIMIZED)
    runPriceActionStrategy() {
        console.log('\n🧪 Running Price Action Strategy (S/R + Confluence)...');
        
        let wins = 0;
        let losses = 0;
        let totalPnl = 0;
        
        // Use identified swings as S/R levels
        for (let i = 30; i < this.candles.length - 10; i++) {
            const current = this.candles[i];
            const prev = this.candles[i-1];
            
            // Find nearest support/resistance
            const pastLows = this.swingsLow.filter(s => s.index < i && s.index > i - 100);
            const pastHighs = this.swingsHigh.filter(s => s.index < i && s.index > i - 100);
            
            if (pastLows.length === 0 || pastHighs.length === 0) continue;
            
            // Get most recent significant levels
            const nearestSupport = pastLows[pastLows.length - 1];
            const nearestResistance = pastHighs[pastHighs.length - 1];
            
            // Check for rejection wicks at S/R (price action signal)
            const longWickAtSupport = current.low < nearestSupport.price * 1.005 && 
                                      current.close > current.open && 
                                      (current.close - current.low) > (current.high - current.low) * 0.7;
            
            const longWickAtResistance = current.high > nearestResistance.price * 0.995 && 
                                         current.close < current.open && 
                                         (current.open - current.low) > (current.high - current.low) * 0.7;
            
            // Long at Support with rejection
            if (longWickAtSupport) {
                const entry = current.close;
                const sl = current.low * 0.998;
                const tp = entry + ((entry - sl) * 2.5);
                
                const result = this.simulateTrade('LONG', entry, sl, tp, i, 'S/R+Rejection');
                if (result) {
                    totalPnl += result.pnl;
                    if (result.pnl > 0) wins++; else losses++;
                    this.trades.push(result);
                }
            }
            
            // Short at Resistance with rejection
            if (longWickAtResistance) {
                const entry = current.close;
                const sl = current.high * 1.002;
                const tp = entry - ((sl - entry) * 2.5);
                
                const result = this.simulateTrade('SHORT', entry, sl, tp, i, 'S/R+Rejection');
                if (result) {
                    totalPnl += result.pnl;
                    if (result.pnl > 0) wins++; else losses++;
                    this.trades.push(result);
                }
            }
        }
        
        return { wins, losses, totalPnl };
    }

    simulateTrade(type, entry, sl, tp, startIndex, reason = 'SMC') {
        // Simulate trade from startIndex forward
        for (let j = startIndex + 1; j < this.candles.length; j++) {
            const candle = this.candles[j];
            
            let closed = false;
            let closePrice = 0;
            let closeReason = '';
            
            if (type === 'LONG') {
                if (candle.low <= sl) {
                    closed = true; closePrice = sl; closeReason = 'SL';
                } else if (candle.high >= tp) {
                    closed = true; closePrice = tp; closeReason = 'TP';
                }
            } else {
                if (candle.high >= sl) {
                    closed = true; closePrice = sl; closeReason = 'SL';
                } else if (candle.low <= tp) {
                    closed = true; closePrice = tp; closeReason = 'TP';
                }
            }
            
            // Force close after 50 candles (timeout)
            if (!closed && j > startIndex + 50) {
                closed = true; closePrice = candle.close; closeReason = 'TIMEOUT';
            }
            
            if (closed) {
                const grossPnl = type === 'LONG' 
                    ? (closePrice - entry) 
                    : (entry - closePrice);
                
                const fee = (entry * CONFIG.takerFee) + (closePrice * CONFIG.takerFee);
                const slip = entry * CONFIG.slippage;
                
                const netPnl = (grossPnl * CONFIG.leverage) - fee - slip;
                const pnlPercent = netPnl / entry;
                
                return {
                    type,
                    entry,
                    closePrice,
                    sl,
                    tp,
                    pnl: netPnl,
                    pnlPercent,
                    reason: `${reason}-${closeReason}`,
                    startIndex,
                    endIndex: j,
                    duration: j - startIndex
                };
            }
        }
        
        return null; // Trade never closed
    }

    calculateMetrics(strategyName, results) {
        const { wins, losses, totalPnl } = results;
        const totalTrades = wins + losses;
        
        if (totalTrades === 0) {
            console.log(`\n❌ ${strategyName}: No trades generated`);
            return null;
        }
        
        const winRate = (wins / totalTrades) * 100;
        const avgWin = this.trades.filter(t => t.pnl > 0 && t.reason.includes(strategyName.split(' ')[0]))
                                  .reduce((sum, t) => sum + t.pnl, 0) / (wins || 1);
        const avgLoss = this.trades.filter(t => t.pnl <= 0 && t.reason.includes(strategyName.split(' ')[0]))
                                   .reduce((sum, t) => sum + Math.abs(t.pnl), 0) / (losses || 1);
        
        const profitFactor = wins > 0 && losses > 0 
            ? (avgWin * wins) / (avgLoss * losses) 
            : (avgWin * wins) / 0.01;
        
        const expectancy = ((winRate / 100) * avgWin) - (((100 - winRate) / 100) * avgLoss);
        
        return {
            strategy: strategyName,
            totalTrades,
            wins,
            losses,
            winRate: winRate.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            expectancy: expectancy.toFixed(2),
            totalPnl: totalPnl.toFixed(2),
            hasEdge: profitFactor > 1.5 && winRate > 45
        };
    }

    runAllStrategies() {
        console.log('\n' + '='.repeat(60));
        console.log('🔬 STARTING SMC/ICT STRATEGY BACKTEST');
        console.log('='.repeat(60));
        
        // Identify structures once
        this.identifySwings();
        this.identifyFVGs();
        
        console.log(`📊 Identified ${this.swingsHigh.length} swing highs and ${this.swingsLow.length} swing lows`);
        console.log(`📊 Identified ${this.fvgBullish.length} bullish FVGs and ${this.fvgBearish.length} bearish FVGs`);
        
        // Run strategies
        const smcResults = this.runSMCStrategy();
        const obResults = this.runOrderBlockStrategy();
        const paResults = this.runPriceActionStrategy();
        
        // Calculate metrics
        const metrics = [
            this.calculateMetrics('SMC Sweep+MSS+FVG', smcResults),
            this.calculateMetrics('Order Block', obResults),
            this.calculateMetrics('Price Action S/R', paResults)
        ].filter(m => m !== null);
        
        // Print Results
        console.log('\n' + '='.repeat(60));
        console.log('📈 BACKTEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        console.table(metrics.map(m => ({
            Strategy: m.strategy,
            Trades: m.totalTrades,
            'Win Rate': `${m.winRate}%`,
            'Profit Factor': m.profitFactor,
            'Total PNL': `$${m.totalPnl}`,
            'HAS EDGE?': m.hasEdge ? '✅ YES' : '❌ NO'
        })));
        
        // Find winner
        const winner = metrics.reduce((best, current) => 
            parseFloat(current.profitFactor) > parseFloat(best.profitFactor) ? current : best
        );
        
        console.log('\n' + '🏆 '.repeat(20));
        if (winner.hasEdge) {
            console.log(`🎯 WINNER: ${winner.strategy}`);
            console.log(`   Profit Factor: ${winner.profitFactor}`);
            console.log(`   Win Rate: ${winner.winRate}%`);
            console.log(`   Total PNL: $${winner.totalPnl}`);
            console.log('\n✅ This strategy shows STATISTICAL EDGE!');
        } else {
            console.log('⚠️  NO STRATEGY SHOWED STRONG EDGE (PF > 1.5)');
            console.log('💡 Best performer:', winner.strategy);
            console.log('   But requires optimization or different market conditions');
        }
        
        // Detailed trade analysis
        console.log('\n' + '='.repeat(60));
        console.log('📋 SAMPLE TRADES (Last 5)');
        console.log('='.repeat(60));
        
        const sampleTrades = this.trades.slice(-5);
        sampleTrades.forEach((t, i) => {
            console.log(`${i+1}. ${t.type} | Entry: $${t.entry.toFixed(2)} | Exit: $${t.closePrice.toFixed(2)} | PNL: $${t.pnl.toFixed(2)} | ${t.reason}`);
        });
        
        return metrics;
    }
}

// --- EXECUTION ---
const runBacktest = async () => {
    const engine = new BacktestEngine();
    
    await engine.fetchData();
    const results = engine.runAllStrategies();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ BACKTEST COMPLETE');
    console.log('='.repeat(60));
    
    // Save results to file
    const fs = require('fs');
    const report = `
# SMC/ICT Strategy Backtest Report

## Configuration
- Symbol: ${CONFIG.symbol}
- Leverage: ${CONFIG.leverage}x
- Interval: ${CONFIG.interval}
- Period: ${new Date(engine.candles[0].time).toISOString()} to ${new Date(engine.candles[engine.candles.length - 1].time).toISOString()}
- Total Candles: ${engine.candles.length}

## Results Summary
${JSON.stringify(results, null, 2)}

## Conclusion
${results.find(r => r.hasEdge) 
    ? '✅ At least one strategy demonstrated statistical edge (Profit Factor > 1.5)' 
    : '❌ No strategy showed consistent edge. Consider:\n  - Adjusting parameters\n  - Adding filters (volume, volatility)\n  - Testing different timeframes\n  - Combining strategies'}
`;
    
    fs.writeFileSync('/workspace/examples/SMC-BACKTEST-REPORT.md', report);
    console.log('\n📄 Full report saved to: /workspace/examples/SMC-BACKTEST-REPORT.md');
};

runBacktest().catch(console.error);
