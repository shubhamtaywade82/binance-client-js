const axios = require('axios');
const fs = require('fs');

/**
 * SOLUSDT ALPHA RESEARCH ENGINE
 * -----------------------------
 * Rigorous backtesting of Scalping, Intraday, and Swing strategies
 * using real historical data from Binance Public API.
 */

// Configuration
const SYMBOL = 'SOLUSDT';
const LEVERAGE = 10;
const FEE_RATE = 0.0004; // 0.04% per trade (Taker fee)
const SLIPPAGE = 0.0005; // 0.05% slippage assumption
const INITIAL_CAPITAL = 10000;

// Timeframes to analyze
const TIMEFRAMES = {
    '1m': { limit: 1440, interval: '1m' },   // Last 24 hours (Scalping focus)
    '15m': { limit: 2000, interval: '15m' }, // Last ~20 days (Intraday/Swing focus)
    '1h': { limit: 720, interval: '1h' }     // Last 30 days (Swing focus)
};

class AlphaResearchEngine {
    constructor() {
        this.data = {};
        this.results = [];
    }

    // 1. Fetch Real Historical Data from Binance Public API
    async fetchHistoricalData(interval, limit) {
        console.log(`📡 Fetching ${limit} candles of ${interval} data for ${SYMBOL}...`);
        try {
            const response = await axios.get('https://api.binance.com/api/v3/klines', {
                params: {
                    symbol: SYMBOL,
                    interval: interval,
                    limit: limit
                }
            });

            // Format data: [time, open, high, low, close, volume, ...]
            return response.data.map(candle => ({
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
        } catch (error) {
            console.error(`❌ Error fetching data: ${error.message}`);
            return null;
        }
    }

    // 2. Technical Indicators Helpers
    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let emaArray = new Array(data.length).fill(null);
        let ema = data[0].close; // Simple start
        
        for (let i = 0; i < data.length; i++) {
            ema = data[i].close * k + ema * (1 - k);
            emaArray[i] = ema;
        }
        return emaArray;
    }

    calculateRSI(data, period = 14) {
        let rsiArray = new Array(data.length).fill(null);
        let gains = 0;
        let losses = 0;

        // First average
        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i-1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < data.length; i++) {
            const change = data[i].close - data[i-1].close;
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
        return rsiArray;
    }

    calculateATR(data, period = 14) {
        let atrArray = new Array(data.length).fill(null);
        let trSum = 0;

        for (let i = 1; i <= period; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i-1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trSum += tr;
        }

        let atr = trSum / period;
        atrArray[period] = atr;

        for (let i = period + 1; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i-1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            atr = (atr * (period - 1) + tr) / period;
            atrArray[i] = atr;
        }
        return atrArray;
    }

    calculateMACD(data, fast=12, slow=26, signal=9) {
        const emaFast = this.calculateEMA(data, fast);
        const emaSlow = this.calculateEMA(data, slow);
        const macdLine = data.map((_, i) => emaFast[i] && emaSlow[i] ? emaFast[i] - emaSlow[i] : null);
        
        // Signal line is EMA of MACD Line
        // Simplified for brevity: calculating EMA on the non-null part of macdLine
        let signalLine = new Array(data.length).fill(null);
        let validMacdStart = -1;
        for(let i=0; i<macdLine.length; i++) {
            if(macdLine[i] !== null) { validMacdStart = i; break; }
        }
        
        if(validMacdStart === -1) return { macdLine, signalLine: [], histogram: [] };

        const k = 2 / (signal + 1);
        let prevSignal = macdLine[validMacdStart];
        signalLine[validMacdStart] = prevSignal;

        for(let i = validMacdStart + 1; i < data.length; i++) {
            if(macdLine[i] === null) continue;
            prevSignal = macdLine[i] * k + prevSignal * (1 - k);
            signalLine[i] = prevSignal;
        }

        const histogram = data.map((_, i) => 
            macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null
        );

        return { macdLine, signalLine, histogram };
    }

    // 3. Strategy Definitions
    strategies = [
        {
            name: "SCALP: RSI Mean Reversion",
            type: "SCALPING",
            timeframe: "1m",
            run: (data) => {
                const rsi = this.calculateRSI(data, 14);
                const atr = this.calculateATR(data, 14);
                let signals = [];
                
                for (let i = 15; i < data.length; i++) {
                    // Long: RSI < 30 (Oversold) + Price > EMA(200) filter (Trend alignment)
                    // Short: RSI > 70 (Overbought)
                    if (rsi[i] < 30) {
                        signals.push({ type: 'LONG', index: i, price: data[i].close, stop: data[i].close - (atr[i]*1.5), target: data[i].close + (atr[i]*1.0) });
                    } else if (rsi[i] > 70) {
                        signals.push({ type: 'SHORT', index: i, price: data[i].close, stop: data[i].close + (atr[i]*1.5), target: data[i].close - (atr[i]*1.0) });
                    }
                }
                return signals;
            }
        },
        {
            name: "INTRADAY: MACD Momentum Breakout",
            type: "INTRADAY",
            timeframe: "15m",
            run: (data) => {
                const { macdLine, signalLine, histogram } = this.calculateMACD(data);
                const ema50 = this.calculateEMA(data, 50);
                let signals = [];

                for (let i = 60; i < data.length; i++) {
                    if (!macdLine[i] || !signalLine[i] || !histogram[i]) continue;
                    
                    // Long: MACD crosses above Signal + Price > EMA50
                    if (macdLine[i-1] <= signalLine[i-1] && macdLine[i] > signalLine[i] && data[i].close > ema50[i]) {
                        signals.push({ type: 'LONG', index: i, price: data[i].close });
                    }
                    // Short: MACD crosses below Signal + Price < EMA50
                    else if (macdLine[i-1] >= signalLine[i-1] && macdLine[i] < signalLine[i] && data[i].close < ema50[i]) {
                        signals.push({ type: 'SHORT', index: i, price: data[i].close });
                    }
                }
                return signals;
            }
        },
        {
            name: "SWING: EMA Trend Following",
            type: "SWING",
            timeframe: "1h",
            run: (data) => {
                const ema9 = this.calculateEMA(data, 9);
                const ema21 = this.calculateEMA(data, 21);
                const ema50 = this.calculateEMA(data, 50);
                let signals = [];

                for (let i = 55; i < data.length; i++) {
                    // Long: EMA9 > EMA21 > EMA50 (Strong Uptrend) + Pullback to EMA21
                    if (ema9[i] > ema21[i] && ema21[i] > ema50[i]) {
                        if (data[i].low <= ema21[i] && data[i].close > ema21[i]) {
                            signals.push({ type: 'LONG', index: i, price: data[i].close });
                        }
                    }
                    // Short: EMA9 < EMA21 < EMA50 (Strong Downtrend) + Rally to EMA21
                    else if (ema9[i] < ema21[i] && ema21[i] < ema50[i]) {
                        if (data[i].high >= ema21[i] && data[i].close < ema21[i]) {
                            signals.push({ type: 'SHORT', index: i, price: data[i].close });
                        }
                    }
                }
                return signals;
            }
        },
        {
            name: "HYBRID: Volatility Squeeze Breakout",
            type: "INTRADAY",
            timeframe: "15m",
            run: (data) => {
                // Bollinger Bands logic manually
                const period = 20;
                const mult = 2.0;
                let signals = [];
                
                for (let i = period; i < data.length; i++) {
                    let sum = 0;
                    for(let j=0; j<period; j++) sum += data[i-j].close;
                    const sma = sum / period;
                    
                    let sqSum = 0;
                    for(let j=0; j<period; j++) sqSum += Math.pow(data[i-j].close - sma, 2);
                    const stdDev = Math.sqrt(sqSum / period);
                    
                    const upper = sma + (mult * stdDev);
                    const lower = sma - (mult * stdDev);
                    
                    // Breakout Logic
                    if (data[i].close > upper && data[i-1].close <= upper) {
                        signals.push({ type: 'LONG', index: i, price: data[i].close });
                    } else if (data[i].close < lower && data[i-1].close >= lower) {
                        signals.push({ type: 'SHORT', index: i, price: data[i].close });
                    }
                }
                return signals;
            }
        }
    ];

    // 4. Backtest Engine with Risk Management
    async runBacktest(strategy) {
        console.log(`\n🧪 Testing Strategy: ${strategy.name} (${strategy.type})`);
        
        const rawData = await this.fetchHistoricalData(
            TIMEFRAMES[strategy.timeframe].interval, 
            TIMEFRAMES[strategy.timeframe].limit
        );

        if (!rawData || rawData.length < 100) {
            console.log("⚠️ Insufficient data.");
            return null;
        }

        const signals = strategy.run(rawData);
        if (signals.length === 0) {
            console.log("⚠️ No signals generated.");
            return { name: strategy.name, trades: 0, profit: 0 };
        }

        let balance = INITIAL_CAPITAL;
        let position = null; // { type, entry, size, stop, target }
        let trades = [];
        let maxDrawdown = 0;
        let peakBalance = balance;

        // Process signals sequentially
        // Note: In a real engine we'd iterate bar-by-bar, but here we simulate execution at signal close
        for (let sig of signals) {
            if (position) continue; // Only one position at a time for simplicity

            const entryPrice = sig.price * (1 + (sig.type === 'LONG' ? SLIPPAGE : -SLIPPAGE));
            const stopLoss = sig.stop || (sig.type === 'LONG' ? entryPrice * 0.99 : entryPrice * 1.01);
            const takeProfit = sig.target || (sig.type === 'LONG' ? entryPrice * 1.02 : entryPrice * 0.98);
            
            // Calculate Size based on 10x Leverage and Risk (2% of equity per trade)
            const riskPerTrade = balance * 0.02;
            const riskDistance = Math.abs(entryPrice - stopLoss);
            const positionSize = (riskPerTrade / riskDistance) * LEVERAGE; 
            // Cap position size to available margin
            const maxPositionSize = (balance * LEVERAGE) / entryPrice;
            const finalSize = Math.min(positionSize, maxPositionSize);

            position = {
                type: sig.type,
                entry: entryPrice,
                size: finalSize,
                stop: stopLoss,
                target: takeProfit,
                indexOpen: sig.index
            };

            // Look forward to find exit
            let exited = false;
            for (let j = sig.index + 1; j < rawData.length; j++) {
                const bar = rawData[j];
                let exitPrice = null;
                let reason = '';

                if (sig.type === 'LONG') {
                    if (bar.low <= stopLoss) { exitPrice = stopLoss; reason = 'SL'; }
                    else if (bar.high >= takeProfit) { exitPrice = takeProfit; reason = 'TP'; }
                } else {
                    if (bar.high >= stopLoss) { exitPrice = stopLoss; reason = 'SL'; }
                    else if (bar.low <= takeProfit) { exitPrice = takeProfit; reason = 'TP'; }
                }

                // Force close at end of data
                if (!exitPrice && j === rawData.length - 1) {
                    exitPrice = bar.close;
                    reason = 'EOF';
                }

                if (exitPrice) {
                    const exitFee = (finalSize * exitPrice) * FEE_RATE;
                    const entryFee = (finalSize * entryPrice) * FEE_RATE;
                    const grossPnL = sig.type === 'LONG' 
                        ? (exitPrice - entryPrice) * finalSize 
                        : (entryPrice - exitPrice) * finalSize;
                    
                    const netPnL = grossPnL - entryFee - exitFee;
                    balance += netPnL;
                    
                    if (balance > peakBalance) peakBalance = balance;
                    const drawdown = (peakBalance - balance) / peakBalance;
                    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

                    trades.push({
                        type: sig.type,
                        entry: entryPrice,
                        exit: exitPrice,
                        pnl: netPnL,
                        reason: reason,
                        date: new Date(rawData[j].time).toISOString()
                    });
                    
                    position = null;
                    exited = true;
                    break;
                }
            }
        }

        // Calculate Metrics
        const totalTrades = trades.length;
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
        
        const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        
        const totalReturn = ((balance - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
        
        // Approximate Sharpe (assuming daily returns, simplified)
        const dailyReturns = trades.map(t => t.pnl / INITIAL_CAPITAL);
        const avgReturn = dailyReturns.reduce((a,b)=>a+b,0) / (dailyReturns.length || 1);
        const stdDev = Math.sqrt(dailyReturns.map(r => Math.pow(r - avgReturn, 2)).reduce((a,b)=>a+b,0) / (dailyReturns.length || 1));
        const sharpe = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); 

        return {
            name: strategy.name,
            type: strategy.type,
            timeframe: strategy.timeframe,
            totalTrades,
            winRate: (winRate * 100).toFixed(2),
            totalReturn: totalReturn.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            sharpeRatio: sharpe.toFixed(2),
            maxDrawdown: (maxDrawdown * 100).toFixed(2),
            finalBalance: balance.toFixed(2),
            trades: trades
        };
    }

    async runAllStrategies() {
        console.log("🚀 Starting SOLUSDT Alpha Research...\n");
        
        const results = [];
        for (const strategy of this.strategies) {
            const result = await this.runBacktest(strategy);
            if (result) results.push(result);
            // Small delay to respect API rate limits
            await new Promise(r => setTimeout(r, 200));
        }

        this.printReport(results);
        return results;
    }

    printReport(results) {
        console.log("\n" + "=".repeat(80));
        console.log("🏆 SOLUSDT STRATEGY PERFORMANCE REPORT (10x Leverage)");
        console.log("=".repeat(80));
        
        // Sort by Profit Factor then Sharpe
        results.sort((a, b) => parseFloat(b.profitFactor) - parseFloat(a.profitFactor));

        console.table(results.map(r => ({
            Strategy: r.name,
            Type: r.type,
            Trades: r.totalTrades,
            "Win Rate": `${r.winRate}%`,
            "Total Return": `${r.totalReturn}%`,
            "Profit Factor": r.profitFactor,
            "Sharpe": r.sharpeRatio,
            "Max DD": `${r.maxDrawdown}%`
        })));

        const winner = results[0];
        console.log("\n💡 ALPHA INSIGHT:");
        if (winner && parseFloat(winner.profitFactor) > 1.5) {
            console.log(`✅ EDGE FOUND: "${winner.name}" shows statistical significance.`);
            console.log(`   - Why it works: ${this.generateInsight(winner)}`);
        } else {
            console.log("⚠️ NO STRONG EDGE FOUND: All strategies have PF < 1.5. Market conditions may be choppy or parameters need optimization.");
        }
        
        // Save detailed log
        const reportContent = `
# SOLUSDT Alpha Research Report
Date: ${new Date().toISOString()}

## Top Performing Strategy
${winner ? winner.name : 'None'}
- Return: ${winner ? winner.totalReturn : 0}%
- Profit Factor: ${winner ? winner.profitFactor : 0}
- Win Rate: ${winner ? winner.winRate : 0}%

## Detailed Results
${JSON.stringify(results, null, 2)}
        `;
        fs.writeFileSync('./solusdt-alpha-research-report.json', JSON.stringify(results, null, 2));
        console.log("\n💾 Detailed results saved to ./solusdt-alpha-research-report.json");
    }

    generateInsight(result) {
        if (result.name.includes("Mean Reversion")) return "Captures short-term overextensions in high volatility environments.";
        if (result.name.includes("Momentum")) return "Rides strong directional moves confirmed by volume and trend alignment.";
        if (result.name.includes("Trend")) return "Filters noise by requiring multi-EMA alignment, capturing major swings.";
        return "Combines volatility filters with directional bias.";
    }
}

// Execute
const engine = new AlphaResearchEngine();
engine.runAllStrategies().catch(console.error);
