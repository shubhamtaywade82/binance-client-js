/**
 * ENHANCED INSTITUTIONAL SMC/ICT BACKTESTER v2
 * ---------------------------------------------
 * Optimized for Alpha Discovery
 * - Relaxed time windows for object interaction
 * - Multiple entry models (Aggressive vs Conservative)
 * - Dynamic confidence scoring
 * - Real market data fetch from Binance Public API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// --- CONFIGURATION ---
const CONFIG = {
    symbol: 'SOLUSDT',
    leverage: 10,
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
    exits: {
        stopLossPct: 0.012, // 1.2% - tighter stops
        takeProfitPct: 0.024, // 2.4% - 1:2 RR
        breakevenTrigger: 0.006 // Move to BE after 0.6% profit
    },
    scoring: {
        minConfidence: 70, // Lowered from 80
        weights: {
            bias: 15,
            sweep: 25,
            fvg: 20,
            ob: 20,
            momentum: 10,
            volume: 10
        }
    },
    backtest: {
        days: 30,
        limit: 1000 // Max candles per request
    }
};

// --- DATA STRUCTURES ---

class Candle {
    constructor(data) {
        this.time = data[0];
        this.open = parseFloat(data[1]);
        this.high = parseFloat(data[2]);
        this.low = parseFloat(data[3]);
        this.close = parseFloat(data[4]);
        this.volume = parseFloat(data[5]);
        this.isBullish = this.close > this.open;
        this.isBearish = this.close < this.open;
        this.bodySize = Math.abs(this.close - this.open);
        this.range = this.high - this.low;
    }
    
    get wickUpper() {
        return this.high - Math.max(this.open, this.close);
    }
    
    get wickLower() {
        return Math.min(this.open, this.close) - this.low;
    }
}

// --- BINANCE DATA FETCHER ---

class BinanceDataFetcher {
    async fetchKlines(symbol, interval, startTime, endTime, limit = 1000) {
        return new Promise((resolve, reject) => {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.code) {
                            reject(new Error(`Binance API Error: ${parsed.msg}`));
                        } else {
                            resolve(parsed.map(c => new Candle(c)));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }
    
    async fetchMultiTimeframeData(symbol, days) {
        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);
        
        console.log(`📡 Fetching ${days} days of ${symbol} data from Binance...`);
        
        const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
        const data = {};
        
        for (const tf of timeframes) {
            try {
                // Fetch in chunks if needed
                const candles = await this.fetchKlines(symbol, tf, startTime, endTime, 1000);
                data[tf] = candles;
                console.log(`  ✅ ${tf}: ${candles.length} candles`);
            } catch (error) {
                console.error(`  ❌ Failed to fetch ${tf}: ${error.message}`);
                data[tf] = [];
            }
        }
        
        return data;
    }
}

// --- MARKET OBJECT DETECTION ---

class MarketObjectDetector {
    constructor(data) {
        this.data = data;
        this.objects = {
            liquidity: [],
            ob: [],
            fvg: [],
            breaker: [],
            structure: []
        };
    }
    
    detectAll() {
        console.log('🔍 Detecting Market Objects...');
        this.detectLiquidity('4h', 10);
        this.detectLiquidity('1h', 5);
        this.detectOrderBlocks('15m');
        this.detectOrderBlocks('1h');
        this.detectFVG('5m');
        this.detectFVG('15m');
        this.detectMarketStructure('4h');
        console.log(`  Found: ${this.objects.liquidity.length} liquidity pools, ${this.objects.ob.length} OBs, ${this.objects.fvg.length} FVGs`);
        return this.objects;
    }
    
    detectLiquidity(tf, swingSize) {
        const candles = this.data[tf];
        if (candles.length < swingSize * 2) return;
        
        for (let i = swingSize; i < candles.length - swingSize; i++) {
            const center = candles[i];
            const left = candles.slice(i - swingSize, i);
            const right = candles.slice(i + 1, i + 1 + swingSize);
            
            const maxLeftHigh = Math.max(...left.map(c => c.high));
            const maxRightHigh = Math.max(...right.map(c => c.high));
            const minLeftLow = Math.min(...left.map(c => c.low));
            const minRightLow = Math.min(...right.map(c => c.low));
            
            if (center.high > maxLeftHigh && center.high > maxRightHigh) {
                this.objects.liquidity.push({
                    type: 'BSL',
                    price: center.high,
                    time: center.time,
                    tf: tf,
                    swept: false,
                    strength: swingSize
                });
            }
            
            if (center.low < minLeftLow && center.low < minRightLow) {
                this.objects.liquidity.push({
                    type: 'SSL',
                    price: center.low,
                    time: center.time,
                    tf: tf,
                    swept: false,
                    strength: swingSize
                });
            }
        }
    }
    
    detectOrderBlocks(tf) {
        const candles = this.data[tf];
        if (candles.length < 3) return;
        
        for (let i = 1; i < candles.length - 2; i++) {
            const curr = candles[i];
            const next = candles[i + 1];
            const after = candles[i + 2];
            
            // Bullish OB: Down candle followed by strong upward displacement
            if (curr.isBearish && next.isBullish && next.close > curr.high) {
                const displacement = next.bodySize / curr.bodySize;
                if (displacement > 1.5 && after.close > next.close) {
                    this.objects.ob.push({
                        type: 'OB',
                        side: 'bullish',
                        min: curr.low,
                        max: curr.high,
                        time: curr.time,
                        tf: tf,
                        strength: Math.min(100, displacement * 30),
                        mitigated: false
                    });
                }
            }
            
            // Bearish OB: Up candle followed by strong downward displacement
            if (curr.isBullish && next.isBearish && next.close < curr.low) {
                const displacement = next.bodySize / curr.bodySize;
                if (displacement > 1.5 && after.close < next.close) {
                    this.objects.ob.push({
                        type: 'OB',
                        side: 'bearish',
                        min: curr.low,
                        max: curr.high,
                        time: curr.time,
                        tf: tf,
                        strength: Math.min(100, displacement * 30),
                        mitigated: false
                    });
                }
            }
        }
    }
    
    detectFVG(tf) {
        const candles = this.data[tf];
        if (candles.length < 3) return;
        
        for (let i = 2; i < candles.length; i++) {
            const c1 = candles[i - 2];
            const c2 = candles[i - 1];
            const c3 = candles[i];
            
            // Bullish FVG
            if (c1.isBullish && c3.isBullish && c3.low > c1.high) {
                const gapSize = (c3.low - c1.high) / c1.close;
                if (gapSize >= 0.001) { // 0.1% minimum
                    this.objects.fvg.push({
                        type: 'FVG',
                        side: 'bullish',
                        min: c1.high,
                        max: c3.low,
                        time: c3.time,
                        tf: tf,
                        size: gapSize,
                        touched: false,
                        filled: false
                    });
                }
            }
            
            // Bearish FVG
            if (c1.isBearish && c3.isBearish && c3.high < c1.low) {
                const gapSize = (c1.low - c3.high) / c1.close;
                if (gapSize >= 0.001) {
                    this.objects.fvg.push({
                        type: 'FVG',
                        side: 'bearish',
                        min: c3.high,
                        max: c1.low,
                        time: c3.time,
                        tf: tf,
                        size: gapSize,
                        touched: false,
                        filled: false
                    });
                }
            }
        }
    }
    
    detectMarketStructure(tf) {
        const candles = this.data[tf];
        if (candles.length < 20) return;
        
        // Simple HH/HL or LH/LL detection
        let lastHH = 0, lastHL = 0, lastLH = 0, lastLL = 0;
        
        for (let i = 10; i < candles.length - 10; i++) {
            const center = candles[i];
            const left = candles.slice(i - 10, i);
            const right = candles.slice(i + 1, i + 11);
            
            const maxLeft = Math.max(...left.map(c => c.high));
            const maxRight = Math.max(...right.map(c => c.high));
            const minLeft = Math.min(...left.map(c => c.low));
            const minRight = Math.min(...right.map(c => c.low));
            
            if (center.high > maxLeft && center.high > maxRight) {
                if (lastHH > 0 && center.high > lastHH) {
                    this.objects.structure.push({
                        type: 'HH',
                        price: center.high,
                        time: center.time,
                        tf: tf
                    });
                }
                lastHH = center.high;
            }
            
            if (center.low < minLeft && center.low < minRight) {
                if (lastLL > 0 && center.low < lastLL) {
                    this.objects.structure.push({
                        type: 'LL',
                        price: center.low,
                        time: center.time,
                        tf: tf
                    });
                }
                lastLL = center.low;
            }
        }
    }
}

// --- BACKTEST ENGINE ---

class SMCBacktester {
    constructor() {
        this.data = null;
        this.objects = null;
        this.trades = [];
        this.equity = 10000;
        this.currentPosition = null;
        this.bias = 'NEUTRAL';
    }
    
    async initialize() {
        const fetcher = new BinanceDataFetcher();
        this.data = await fetcher.fetchMultiTimeframeData(CONFIG.symbol, CONFIG.backtest.days);
        
        if (this.data['1m'].length === 0) {
            throw new Error('No data fetched. Check symbol or network.');
        }
        
        const detector = new MarketObjectDetector(this.data);
        this.objects = detector.detectAll();
        this.determineBias();
    }
    
    determineBias() {
        const daily = this.data['1d'];
        if (daily.length < 5) return;
        
        const recent = daily.slice(-5);
        const highs = recent.map(c => c.high);
        const lows = recent.map(c => c.low);
        
        // More lenient bias detection
        const lastClose = recent[recent.length - 1].close;
        const firstOpen = recent[0].open;
        
        if (lastClose > firstOpen * 1.02) {
            this.bias = 'BULLISH';
        } else if (lastClose < firstOpen * 0.98) {
            this.bias = 'BEARISH';
        } else {
            // Check 4H for intraday bias
            const h4 = this.data['4h'];
            if (h4.length >= 10) {
                const h4Recent = h4.slice(-10);
                const h4Uptrend = h4Recent.filter(c => c.close > c.open).length > 6;
                const h4Downtrend = h4Recent.filter(c => c.close < c.open).length > 6;
                
                if (h4Uptrend) this.bias = 'BULLISH';
                else if (h4Downtrend) this.bias = 'BEARISH';
                else this.bias = 'RANGE';
            } else {
                this.bias = 'RANGE';
            }
        }
        
        console.log(`📊 Daily Bias: ${this.bias}`);
    }
    
    run() {
        console.log('⚙️ Running Backtest on 1m Data...');
        const candles = this.data['1m'];
        const warmup = 50; // Allow object detection to stabilize
        
        for (let i = warmup; i < candles.length; i++) {
            const candle = candles[i];
            this.updateObjects(candle);
            
            if (!this.currentPosition) {
                this.checkEntry(candle);
            } else {
                this.manageExit(candle);
            }
        }
        
        // Close remaining position
        if (this.currentPosition) {
            this.closeTrade(this.currentPosition, candles[candles.length - 1].close, 'END_OF_DATA');
        }
    }
    
    updateObjects(candle) {
        // Update liquidity sweeps
        this.objects.liquidity.forEach(liq => {
            if (!liq.swept) {
                if ((liq.type === 'BSL' && candle.high >= liq.price) ||
                    (liq.type === 'SSL' && candle.low <= liq.price)) {
                    liq.swept = true;
                    liq.sweepTime = candle.time;
                }
            }
        });
        
        // Update FVG touches
        this.objects.fvg.forEach(fvg => {
            if (!fvg.touched) {
                if (candle.low <= fvg.max && candle.high >= fvg.min) {
                    fvg.touched = true;
                    fvg.touchTime = candle.time;
                }
            }
            // Check if filled
            if (fvg.touched && !fvg.filled) {
                if ((fvg.side === 'bullish' && candle.close > fvg.max) ||
                    (fvg.side === 'bearish' && candle.close < fvg.min)) {
                    fvg.filled = true;
                }
            }
        });
        
        // Update OB mitigations
        this.objects.ob.forEach(ob => {
            if (!ob.mitigated) {
                if (candle.low <= ob.max && candle.high >= ob.min) {
                    ob.mitigated = true;
                    ob.mitigationTime = candle.time;
                }
            }
        });
    }
    
    checkEntry(candle) {
        let score = 0;
        let direction = null;
        let reasons = [];
        
        // 1. Bias Alignment (15 pts) - Allow trading in RANGE with reduced score
        if (this.bias === 'BULLISH') {
            direction = 'LONG';
            score += CONFIG.scoring.weights.bias;
            reasons.push('Bias:BULL');
        } else if (this.bias === 'BEARISH') {
            direction = 'SHORT';
            score += CONFIG.scoring.weights.bias;
            reasons.push('Bias:BEAR');
        } else {
            // In RANGE, use recent price action to determine direction
            const candles1m = this.data['1m'];
            const idx = candles1m.indexOf(candle);
            if (idx < 20) return;
            
            const recent20 = candles1m.slice(idx - 20, idx);
            const bullishCandles = recent20.filter(c => c.close > c.open).length;
            
            if (bullishCandles > 12) {
                direction = 'LONG';
                reasons.push('Bias:RANGE-BULL');
                score += 10; // Reduced score for range bias
            } else if (bullishCandles < 8) {
                direction = 'SHORT';
                reasons.push('Bias:RANGE-BEAR');
                score += 10;
            } else {
                return; // Truly neutral
            }
        }
        
        // 2. Recent Liquidity Sweep (25 pts) - Extended time window
        const timeWindow = 3 * 60 * 60 * 1000; // 3 hours
        const recentSweep = this.objects.liquidity.find(l => 
            l.swept && 
            (candle.time - l.sweepTime) < timeWindow &&
            ((direction === 'LONG' && l.type === 'SSL') || (direction === 'SHORT' && l.type === 'BSL'))
        );
        
        if (recentSweep) {
            score += CONFIG.scoring.weights.sweep;
            reasons.push(`Sweep:${recentSweep.type}`);
        }
        
        // 3. FVG Retest (20 pts) - Extended window
        const activeFVG = this.objects.fvg.find(f => 
            f.side === (direction === 'LONG' ? 'bullish' : 'bearish') &&
            f.touched &&
            (candle.time - f.touchTime) < 2 * 60 * 60 * 1000 && // 2 hour window
            !f.filled
        );
        
        if (activeFVG) {
            score += CONFIG.scoring.weights.fvg;
            reasons.push('FVG:Active');
        }
        
        // 4. OB Mitigation (20 pts) - Extended window
        const activeOB = this.objects.ob.find(ob => 
            ob.side === (direction === 'LONG' ? 'bullish' : 'bearish') &&
            ob.mitigated &&
            (candle.time - ob.mitigationTime) < 3 * 60 * 60 * 1000
        );
        
        if (activeOB) {
            score += CONFIG.scoring.weights.ob;
            reasons.push('OB:Mitigated');
        }
        
        // 5. Momentum (10 pts)
        const prevCandle = this.data['1m'][this.data['1m'].indexOf(candle) - 1];
        if (prevCandle) {
            const momentum = (candle.close - prevCandle.close) / prevCandle.close;
            if ((direction === 'LONG' && momentum > 0.0005) ||
                (direction === 'SHORT' && momentum < -0.0005)) {
                score += CONFIG.scoring.weights.momentum;
                reasons.push('Momentum:+');
            }
        }
        
        console.log(`🔎 Signal Check: Score=${score}, Dir=${direction}, Reasons=${reasons.join('|')}`);
        
        // Execute if score meets threshold
        if (score >= CONFIG.scoring.minConfidence) {
            const entryPrice = candle.close;
            const stopLoss = direction === 'LONG' 
                ? entryPrice * (1 - CONFIG.exits.stopLossPct)
                : entryPrice * (1 + CONFIG.exits.stopLossPct);
            const takeProfit = direction === 'LONG'
                ? entryPrice * (1 + CONFIG.exits.takeProfitPct)
                : entryPrice * (1 - CONFIG.exits.takeProfitPct);
            
            this.openTrade(direction, entryPrice, stopLoss, takeProfit, reasons.join('|'), score);
        }
    }
    
    openTrade(type, entry, sl, tp, reason, confidence) {
        this.currentPosition = {
            type,
            entry,
            sl,
            tp,
            reason,
            confidence,
            startTime: Date.now(),
            highest: type === 'LONG' ? entry : null,
            lowest: type === 'SHORT' ? entry : null
        };
        
        console.log(`🚀 OPEN ${type} @ ${entry.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | Score: ${confidence}`);
    }
    
    manageExit(candle) {
        const pos = this.currentPosition;
        let exit = false;
        let exitPrice = 0;
        let exitReason = '';
        
        // Update extremes for trailing
        if (pos.type === 'LONG') {
            if (candle.high > pos.highest) pos.highest = candle.high;
            if (candle.low <= pos.sl) {
                exit = true;
                exitPrice = pos.sl;
                exitReason = 'STOP_LOSS';
            } else if (candle.high >= pos.tp) {
                exit = true;
                exitPrice = pos.tp;
                exitReason = 'TAKE_PROFIT';
            } else {
                // Trailing stop logic
                const profitPct = (candle.high - pos.entry) / pos.entry;
                if (profitPct > CONFIG.exits.breakevenTrigger) {
                    const trailSL = candle.high * (1 - CONFIG.exits.stopLossPct * 0.5);
                    if (trailSL > pos.sl) pos.sl = trailSL;
                }
            }
        } else {
            if (candle.low < pos.lowest) pos.lowest = candle.low;
            if (candle.high >= pos.sl) {
                exit = true;
                exitPrice = pos.sl;
                exitReason = 'STOP_LOSS';
            } else if (candle.low <= pos.tp) {
                exit = true;
                exitPrice = pos.tp;
                exitReason = 'TAKE_PROFIT';
            } else {
                // Trailing stop logic
                const profitPct = (pos.entry - candle.low) / pos.entry;
                if (profitPct > CONFIG.exits.breakevenTrigger) {
                    const trailSL = candle.low * (1 + CONFIG.exits.stopLossPct * 0.5);
                    if (trailSL < pos.sl) pos.sl = trailSL;
                }
            }
        }
        
        if (exit) {
            this.closeTrade(pos, exitPrice, exitReason);
        }
    }
    
    closeTrade(pos, exitPrice, reason) {
        const rawPnl = pos.type === 'LONG'
            ? (exitPrice - pos.entry) / pos.entry
            : (pos.entry - exitPrice) / pos.entry;
        
        const leveragedPnl = rawPnl * CONFIG.leverage;
        const pnlValue = this.equity * leveragedPnl;
        
        this.equity += pnlValue;
        
        this.trades.push({
            ...pos,
            exitPrice,
            exitReason: reason,
            pnlPercent: leveragedPnl * 100,
            pnlValue,
            status: 'CLOSED'
        });
        
        this.currentPosition = null;
        
        const icon = leveragedPnl > 0 ? '✅' : '❌';
        console.log(`${icon} CLOSE @ ${exitPrice.toFixed(2)} | PnL: ${leveragedPnl.toFixed(4)} ($${pnlValue.toFixed(2)}) | ${reason}`);
    }
    
    generateReport() {
        const total = this.trades.length;
        const wins = this.trades.filter(t => t.pnlPercent > 0);
        const losses = this.trades.filter(t => t.pnlPercent <= 0);
        
        const winRate = total > 0 ? (wins.length / total) * 100 : 0;
        const grossProfit = wins.reduce((sum, t) => sum + t.pnlPercent, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlPercent, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
        
        const totalReturn = ((this.equity - 10000) / 10000) * 100;
        
        const report = {
            summary: {
                totalTrades: total,
                wins: wins.length,
                losses: losses.length,
                winRate: `${winRate.toFixed(2)}%`,
                profitFactor: profitFactor.toFixed(2),
                totalReturn: `${totalReturn.toFixed(2)}%`,
                finalEquity: `$${this.equity.toFixed(2)}`,
                bias: this.bias,
                hasEdge: profitFactor > 1.5 && winRate > 45
            },
            trades: this.trades.map(t => ({
                type: t.type,
                entry: t.entry,
                exit: t.exitPrice,
                pnl: `${t.pnlPercent.toFixed(2)}%`,
                reason: t.reason,
                confidence: t.confidence
            }))
        };
        
        const filePath = path.join(__dirname, 'solusdt-smc-enhanced-backtest.json');
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 ENHANCED SMC BACKTEST RESULTS');
        console.log('='.repeat(50));
        console.log(`Total Trades: ${total}`);
        console.log(`Win Rate: ${winRate.toFixed(2)}%`);
        console.log(`Profit Factor: ${profitFactor.toFixed(2)}`);
        console.log(`Total Return (10x): ${totalReturn.toFixed(2)}%`);
        console.log(`Final Equity: $${this.equity.toFixed(2)}`);
        console.log(`Has Statistical Edge: ${report.summary.hasEdge ? '✅ YES' : '❌ NO'}`);
        console.log('='.repeat(50));
        console.log(`💾 Report saved: ${filePath}`);
        
        return report;
    }
}

// --- MAIN ---

async function main() {
    console.log('🏛️  Enhanced Institutional SMC/ICT Backtester v2\n');
    
    const backtester = new SMCBacktester();
    
    try {
        await backtester.initialize();
        backtester.run();
        backtester.generateReport();
    } catch (error) {
        console.error('❌ Backtest failed:', error.message);
    }
}

main();
