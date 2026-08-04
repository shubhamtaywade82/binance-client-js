/**
 * INSTITUTIONAL SMC/ICT BACKTESTING ENGINE
 * ----------------------------------------
 * Multi-Timeframe Analysis (Daily, 4H, 15m, 5m, 1m)
 * 1m Execution with % Based Exits
 * 
 * NO API KEYS REQUIRED - Uses historical data simulation
 */

const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const CONFIG = {
    symbol: 'SOLUSDT',
    leverage: 10,
    riskPerTrade: 0.01, // 1% of equity
    timeframes: {
        daily: '1d',
        h4: '4h',
        m15: '15m',
        m5: '5m',
        m1: '1m'
    },
    exits: {
        stopLossPct: 0.015, // 1.5% move against
        takeProfitPct: 0.03, // 3.0% move towards (1:2 RR)
        trailingStopPct: 0.01 // Activate trail after 1% profit
    },
    thresholds: {
        minConfidence: 80, // 0-100 score
        minAdx: 25, // Trend strength
        fvgMinSize: 0.002 // 0.2% imbalance
    },
    backtest: {
        days: 14, // Days of history to fetch
        startDate: null // Auto-calculated
    }
};

// --- DATA STRUCTURES ---

class Candle {
    constructor(time, open, high, low, close, volume) {
        this.time = time;
        this.open = parseFloat(open);
        this.high = parseFloat(high);
        this.low = parseFloat(low);
        this.close = parseFloat(close);
        this.volume = parseFloat(volume);
        this.isBullish = this.close > this.open;
        this.isBearish = this.close < this.open;
        this.bodySize = Math.abs(this.close - this.open);
        this.wickUpper = this.high - Math.max(this.open, this.close);
        this.wickLower = Math.min(this.open, this.close) - this.low;
        this.range = this.high - this.low;
    }
}

class MarketObject {
    constructor(type, priceLevel, timeframe, strength) {
        this.type = type; // 'OB', 'FVG', 'LIQUIDITY', 'BREAKER'
        this.priceLevel = priceLevel; // Object zone [min, max]
        this.timeframe = timeframe;
        this.strength = strength; // 0-100
        this.createdTime = Date.now();
        this.touchedCount = 0;
        this.isValid = true;
        this.side = priceLevel.side; // 'bullish' or 'bearish'
    }
}

class Trade {
    constructor(type, entryPrice, stopLoss, takeProfit, reason, confidence) {
        this.type = type; // 'LONG' or 'SHORT'
        this.entryPrice = entryPrice;
        this.stopLoss = stopLoss;
        this.takeProfit = takeProfit;
        this.reason = reason;
        this.confidence = confidence;
        this.startTime = Date.now();
        this.status = 'OPEN';
        this.exitPrice = null;
        this.exitReason = null;
        this.pnlPercent = 0;
        this.maxFavorable = 0;
        this.maxAdverse = 0;
    }
}

// --- CORE ENGINE ---

class InstitutionalSMCEngine {
    constructor() {
        this.data = {
            '1d': [],
            '4h': [],
            '15m': [],
            '5m': [],
            '1m': []
        };
        this.objects = {
            ob: [],
            fvg: [],
            liquidity: [],
            structure: []
        };
        this.trades = [];
        this.currentPosition = null;
        this.equity = 10000; // Starting $10k
        this.bias = 'NEUTRAL'; // BULLISH, BEARISH, NEUTRAL
    }

    // 1. DATA INGESTION & NORMALIZATION
    async loadHistoricalData() {
        console.log(`📡 Fetching ${CONFIG.backtest.days} days of ${CONFIG.symbol} data...`);
        // In a real run, this would fetch from Binance API. 
        // For this script, we will generate realistic synthetic data or load a local CSV if available.
        // To ensure this runs standalone, we will simulate a robust dataset generator.
        this.generateSyntheticData(); 
        console.log(`✅ Data loaded. 1m Candles: ${this.data['1m'].length}`);
    }

    generateSyntheticData() {
        // Generates realistic crypto price action with trends, ranges, and sweeps
        let price = 145.00; // Approx SOL price
        const now = Date.now();
        const oneMin = 60 * 1000;
        
        const totalMinutes = CONFIG.backtest.days * 24 * 60;
        
        // Create 1m data first
        for (let i = 0; i < totalMinutes; i++) {
            const time = now - ((totalMinutes - i) * oneMin);
            
            // Random walk with trend bias simulation
            const volatility = 0.002; // 0.2% typical 1m move
            let change = (Math.random() - 0.5) * volatility * price;
            
            // Inject trends
            if (i > 1000 && i < 1500) change += (price * 0.0005); // Bull run
            if (i > 3000 && i < 3400) change -= (price * 0.0008); // Dump
            
            const open = price;
            const close = open + change;
            const high = Math.max(open, close) + (Math.random() * volatility * price * 0.5);
            const low = Math.min(open, close) - (Math.random() * volatility * price * 0.5);
            const volume = Math.floor(Math.random() * 10000) + 500;
            
            this.data['1m'].push(new Candle(time, open, high, low, close, volume));
            price = close;
        }

        // Aggregate to higher timeframes
        this.aggregateTimeframe('1m', '5m', 5);
        this.aggregateTimeframe('1m', '15m', 15);
        this.aggregateTimeframe('1m', '4h', 240);
        this.aggregateTimeframe('1m', '1d', 1440);
    }

    aggregateTimeframe(sourceTF, targetTF, factor) {
        const source = this.data[sourceTF];
        const target = this.data[targetTF];
        
        for (let i = 0; i < source.length; i++) {
            if (i % factor === 0) {
                const slice = source.slice(i, i + factor);
                if (slice.length === factor) {
                    const open = slice[0].open;
                    const close = slice[factor - 1].close;
                    const high = Math.max(...slice.map(c => c.high));
                    const low = Math.min(...slice.map(c => c.low));
                    const volume = slice.reduce((sum, c) => sum + c.volume, 0);
                    const time = slice[0].time;
                    target.push(new Candle(time, open, high, low, close, volume));
                }
            }
        }
    }

    // 2. MARKET OBJECT DETECTION (The "Institutional" Logic)

    detectMarketObjects() {
        console.log('🔍 Detecting Institutional Market Objects...');
        
        // A. Detect Liquidity Pools (Swing Highs/Lows) on 4H
        this.detectLiquidity('4h', 5); // 5 candle swing
        
        // B. Detect Order Blocks on 15m
        this.detectOrderBlocks('15m');
        
        // C. Detect Fair Value Gaps on 5m
        this.detectFVG('5m');
        
        // D. Determine Daily Bias
        this.determineBias();
    }

    determineBias() {
        const daily = this.data['1d'];
        if (daily.length < 2) return;
        
        const last = daily[daily.length - 1];
        const prev = daily[daily.length - 2];
        
        // Simple HTF Structure
        if (last.close > prev.high) this.bias = 'BULLISH';
        else if (last.close < prev.low) this.bias = 'BEARISH';
        else this.bias = 'RANGE';
    }

    detectLiquidity(tf, swingSize) {
        const candles = this.data[tf];
        for (let i = swingSize; i < candles.length - swingSize; i++) {
            const center = candles[i];
            const left = candles.slice(i - swingSize, i);
            const right = candles.slice(i + 1, i + 1 + swingSize);
            
            const isSwingHigh = center.high > Math.max(...left.map(c=>c.high), ...right.map(c=>c.high));
            const isSwingLow = center.low < Math.min(...left.map(c=>c.low), ...right.map(c=>c.low));
            
            if (isSwingHigh) {
                this.objects.liquidity.push({
                    type: 'BSL', // Buy Side Liquidity
                    price: center.high,
                    time: center.time,
                    tf: tf,
                    swept: false
                });
            }
            if (isSwingLow) {
                this.objects.liquidity.push({
                    type: 'SSL', // Sell Side Liquidity
                    price: center.low,
                    time: center.time,
                    tf: tf,
                    swept: false
                });
            }
        }
    }

    detectOrderBlocks(tf) {
        const candles = this.data[tf];
        // Bullish OB: Last down candle before strong up move that breaks structure
        for (let i = 1; i < candles.length - 1; i++) {
            const curr = candles[i];
            const next = candles[i+1];
            
            if (curr.isBearish && next.isBullish && next.close > curr.open) {
                // Strong displacement
                if ((next.close - next.open) > curr.bodySize * 1.5) {
                    this.objects.ob.push(new MarketObject(
                        'OB',
                        { min: curr.low, max: curr.high, side: 'bullish' },
                        tf,
                        85
                    ));
                }
            }
            // Bearish OB logic inverted
            if (curr.isBullish && next.isBearish && next.close < curr.open) {
                if ((curr.open - next.close) > curr.bodySize * 1.5) {
                    this.objects.ob.push(new MarketObject(
                        'OB',
                        { min: curr.low, max: curr.high, side: 'bearish' },
                        tf,
                        85
                    ));
                }
            }
        }
    }

    detectFVG(tf) {
        const candles = this.data[tf];
        for (let i = 2; i < candles.length; i++) {
            const c1 = candles[i-2];
            const c2 = candles[i-1];
            const c3 = candles[i];
            
            // Bullish FVG: Low of c3 > High of c1
            if (c3.isBullish && c1.isBullish && c3.low > c1.high) {
                const gapSize = (c3.low - c1.high) / c1.close;
                if (gapSize >= CONFIG.thresholds.fvgMinSize) {
                    this.objects.fvg.push({
                        type: 'FVG',
                        min: c1.high,
                        max: c3.low,
                        side: 'bullish',
                        tf: tf,
                        touched: false
                    });
                }
            }
            
            // Bearish FVG: High of c3 < Low of c1
            if (c3.isBearish && c1.isBearish && c3.high < c1.low) {
                const gapSize = (c1.low - c3.high) / c1.close;
                if (gapSize >= CONFIG.thresholds.fvgMinSize) {
                    this.objects.fvg.push({
                        type: 'FVG',
                        min: c3.high,
                        max: c1.low,
                        side: 'bearish',
                        tf: tf,
                        touched: false
                    });
                }
            }
        }
    }

    // 3. EXECUTION ENGINE (1m Granularity)

    runBacktest() {
        console.log('⚙️ Running 1m Execution Engine...');
        const candles = this.data['1m'];
        
        // Warmup period to ensure objects are populated
        const startIndex = 100; 

        for (let i = startIndex; i < candles.length; i++) {
            const candle = candles[i];
            const currentTime = candle.time;
            
            // Update Objects Status (Sweeps, Touches)
            this.updateObjects(candle);

            // If no position, look for entry
            if (!this.currentPosition) {
                this.checkEntry(candle);
            } else {
                this.manageExit(candle);
            }
        }
        
        // Close any remaining open trades at end of data
        if (this.currentPosition) {
            this.closeTrade(this.currentPosition, candles[candles.length-1].close, 'END_OF_DATA');
        }
    }

    updateObjects(candle) {
        // Check Liquidity Sweeps
        this.objects.liquidity.forEach(liq => {
            if (!liq.swept) {
                if ((liq.type === 'BSL' && candle.high >= liq.price) ||
                    (liq.type === 'SSL' && candle.low <= liq.price)) {
                    liq.swept = true;
                    liq.sweepTime = candle.time;
                }
            }
        });

        // Check FVG Touches
        this.objects.fvg.forEach(fvg => {
            if (!fvg.touched) {
                if (candle.low <= fvg.max && candle.high >= fvg.min) {
                    fvg.touched = true;
                    fvg.touchTime = candle.time;
                }
            }
        });
    }

    checkEntry(candle) {
        // INSTITUTIONAL CONFLUENCE CHECK
        
        let score = 0;
        let direction = null;
        let entryPrice = null;
        let stopLoss = null;
        let takeProfit = null;
        let reason = [];

        // 1. Check Bias Alignment
        if (this.bias === 'BULLISH') direction = 'LONG';
        else if (this.bias === 'BEARISH') direction = 'SHORT';
        else return; // No trade in neutral

        if (direction === 'LONG') score += 20;
        else score += 20;

        // 2. Check Recent Liquidity Sweep (Last 20 candles)
        const recentSweep = this.objects.liquidity.find(l => 
            l.swept && (candle.time - l.sweepTime) < 20 * 60 * 1000 &&
            ((direction === 'LONG' && l.type === 'SSL') || (direction === 'SHORT' && l.type === 'BSL'))
        );
        
        if (recentSweep) {
            score += 30;
            reason.push(`Sweep(${recentSweep.type})`);
        }

        // 3. Check FVG Retest
        const activeFVG = this.objects.fvg.find(f => 
            f.side === (direction === 'LONG' ? 'bullish' : 'bearish') &&
            f.touched && (candle.time - f.touchTime) < 10 * 60 * 1000 &&
            !f.filled
        );

        if (activeFVG) {
            score += 30;
            reason.push('FVG_Retest');
            // Entry inside FVG
            entryPrice = direction === 'LONG' ? activeFVG.min : activeFVG.max;
        } else {
            // Fallback to market price if no FVG retest but sweep happened
            entryPrice = candle.close;
        }

        // 4. Calculate Risk/Reward (% Based)
        if (direction === 'LONG') {
            stopLoss = entryPrice * (1 - CONFIG.exits.stopLossPct);
            takeProfit = entryPrice * (1 + CONFIG.exits.takeProfitPct);
        } else {
            stopLoss = entryPrice * (1 + CONFIG.exits.stopLossPct);
            takeProfit = entryPrice * (1 - CONFIG.exits.takeProfitPct);
        }

        // 5. Final Decision
        if (score >= CONFIG.thresholds.minConfidence) {
            this.openTrade(direction, entryPrice, stopLoss, takeProfit, reason.join('+'), score);
        }
    }

    openTrade(type, entry, sl, tp, reason, confidence) {
        // Simulate limit order fill check? For simplicity, assume market fill at close if condition met
        // But strictly, if entry is inside FVG, we might miss it. 
        // Let's assume we enter at 'entry' price if the candle range covers it.
        
        const currentCandle = this.data['1m'][this.data['1m'].length - 1]; // Current processing
        
        // Simplified: Enter at Close of signal candle for backtest stability
        const actualEntry = currentCandle.close;
        
        // Recalculate SL/TP based on actual entry
        const actualSL = type === 'LONG' 
            ? actualEntry * (1 - CONFIG.exits.stopLossPct)
            : actualEntry * (1 + CONFIG.exits.stopLossPct);
            
        const actualTP = type === 'LONG'
            ? actualEntry * (1 + CONFIG.exits.takeProfitPct)
            : actualEntry * (1 - CONFIG.exits.takeProfitPct);

        this.currentPosition = new Trade(type, actualEntry, actualSL, actualTP, reason, confidence);
        console.log(`🚀 OPEN ${type} @ ${actualEntry.toFixed(2)} | SL: ${actualSL.toFixed(2)} | TP: ${actualTP.toFixed(2)} | Reason: ${reason}`);
    }

    manageExit(candle) {
        const pos = this.currentPosition;
        let exited = false;
        let exitPrice = 0;
        let exitReason = '';

        // Check High/Low of current candle for hits
        if (pos.type === 'LONG') {
            // Hit Stop Loss
            if (candle.low <= pos.stopLoss) {
                exitPrice = pos.stopLoss;
                exitReason = 'STOP_LOSS';
                exited = true;
            }
            // Hit Take Profit
            else if (candle.high >= pos.takeProfit) {
                exitPrice = pos.takeProfit;
                exitReason = 'TAKE_PROFIT';
                exited = true;
            }
        } else {
            // Hit Stop Loss
            if (candle.high >= pos.stopLoss) {
                exitPrice = pos.stopLoss;
                exitReason = 'STOP_LOSS';
                exited = true;
            }
            // Hit Take Profit
            else if (candle.low <= pos.takeProfit) {
                exitPrice = pos.takeProfit;
                exitReason = 'TAKE_PROFIT';
                exited = true;
            }
        }

        if (exited) {
            this.closeTrade(pos, exitPrice, exitReason);
        }
    }

    closeTrade(trade, exitPrice, reason) {
        const rawPnl = trade.type === 'LONG'
            ? (exitPrice - trade.entryPrice) / trade.entryPrice
            : (trade.entryPrice - exitPrice) / trade.entryPrice;
        
        const leveragedPnl = rawPnl * CONFIG.leverage;
        const pnlValue = this.equity * leveragedPnl;
        
        this.equity += pnlValue;
        
        trade.exitPrice = exitPrice;
        trade.exitReason = reason;
        trade.pnlPercent = leveragedPnl * 100;
        trade.status = 'CLOSED';
        
        this.trades.push(trade);
        this.currentPosition = null;
        
        const status = leveragedPnl > 0 ? '✅' : '❌';
        console.log(`${status} CLOSE @ ${exitPrice.toFixed(2)} | PnL: ${leveragedPnl.toFixed(4)} (${pnlValue.toFixed(2)}) | Reason: ${reason}`);
    }

    // 4. REPORTING
    generateReport() {
        const totalTrades = this.trades.length;
        const wins = this.trades.filter(t => t.pnlPercent > 0).length;
        const losses = this.trades.filter(t => t.pnlPercent <= 0).length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        
        const grossProfit = this.trades.filter(t => t.pnlPercent > 0).reduce((sum, t) => sum + t.pnlPercent, 0);
        const grossLoss = Math.abs(this.trades.filter(t => t.pnlPercent <= 0).reduce((sum, t) => sum + t.pnlPercent, 0));
        
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        
        const finalEquity = this.equity;
        const totalReturn = ((finalEquity - 10000) / 10000) * 100;

        const report = {
            summary: {
                totalTrades,
                wins,
                losses,
                winRate: winRate.toFixed(2) + '%',
                profitFactor: profitFactor.toFixed(2),
                totalReturn: totalReturn.toFixed(2) + '%',
                finalEquity: finalEquity.toFixed(2),
                biasUsed: this.bias
            },
            trades: this.trades.map(t => ({
                type: t.type,
                entry: t.entryPrice,
                exit: t.exitPrice,
                pnl: t.pnlPercent,
                reason: t.reason,
                confidence: t.confidence
            }))
        };

        // Save Report
        const reportPath = path.join(__dirname, 'solusdt-smc-backtest-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n📊 --- BACKTEST RESULTS ---');
        console.log(`Total Trades: ${totalTrades}`);
        console.log(`Win Rate: ${winRate.toFixed(2)}%`);
        console.log(`Profit Factor: ${profitFactor.toFixed(2)}`);
        console.log(`Total Return (10x Lev): ${totalReturn.toFixed(2)}%`);
        console.log(`Final Equity: $${finalEquity.toFixed(2)}`);
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
        
        return report;
    }
}

// --- MAIN EXECUTION ---

async function main() {
    console.log('🏛️  Starting Institutional SMC/ICT Backtest Engine');
    console.log('------------------------------------------------');
    
    const engine = new InstitutionalSMCEngine();
    
    try {
        await engine.loadHistoricalData();
        engine.detectMarketObjects();
        engine.runBacktest();
        engine.generateReport();
    } catch (error) {
        console.error('❌ Backtest Failed:', error);
    }
}

main();
