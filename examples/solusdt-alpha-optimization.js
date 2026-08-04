const axios = require('axios');
const fs = require('fs');

/**
 * SOLUSDT ALPHA OPTIMIZATION ENGINE - PHASE 2
 * -------------------------------------------
 * Deep dive optimization based on Phase 1 failures.
 * Testing parameter variations and filter combinations.
 */

const SYMBOL = 'SOLUSDT';
const LEVERAGE = 10;
const FEE_RATE = 0.0004;
const SLIPPAGE = 0.0005;
const INITIAL_CAPITAL = 10000;

class AlphaOptimizer {
    constructor() {
        this.bestStrategies = [];
    }

    async fetchHistoricalData(interval, limit) {
        console.log(`📡 Fetching ${limit} candles of ${interval}...`);
        try {
            const response = await axios.get('https://api.binance.com/api/v3/klines', {
                params: { symbol: SYMBOL, interval, limit }
            });
            return response.data.map(candle => ({
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return null;
        }
    }

    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let emaArray = new Array(data.length).fill(null);
        let ema = data[0].close;
        for (let i = 0; i < data.length; i++) {
            ema = data[i].close * k + ema * (1 - k);
            emaArray[i] = ema;
        }
        return emaArray;
    }

    calculateRSI(data, period = 14) {
        let rsiArray = new Array(data.length).fill(null);
        let gains = 0, losses = 0;
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

    calculateMACD(data, fast=12, slow=26, signal=9) {
        const emaFast = this.calculateEMA(data, fast);
        const emaSlow = this.calculateEMA(data, slow);
        const macdLine = data.map((_, i) => emaFast[i] && emaSlow[i] ? emaFast[i] - emaSlow[i] : null);
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

    calculateADX(data, period = 14) {
        let adxArray = new Array(data.length).fill(null);
        let plusDM = new Array(data.length).fill(0);
        let minusDM = new Array(data.length).fill(0);
        let tr = new Array(data.length).fill(0);

        for (let i = 1; i < data.length; i++) {
            const highMove = data[i].high - data[i-1].high;
            const lowMove = data[i-1].low - data[i].low;
            
            if (highMove > lowMove && highMove > 0) plusDM[i] = highMove;
            if (lowMove > highMove && lowMove > 0) minusDM[i] = lowMove;
            
            tr[i] = Math.max(
                data[i].high - data[i].low,
                Math.abs(data[i].high - data[i-1].close),
                Math.abs(data[i].low - data[i-1].close)
            );
        }

        let avgPlusDM = 0, avgMinusDM = 0, avgTR = 0;
        for (let i = 1; i <= period; i++) {
            avgPlusDM += plusDM[i];
            avgMinusDM += minusDM[i];
            avgTR += tr[i];
        }
        avgPlusDM /= period;
        avgMinusDM /= period;
        avgTR /= period;

        for (let i = period + 1; i < data.length; i++) {
            avgPlusDM = (avgPlusDM * (period - 1) + plusDM[i]) / period;
            avgMinusDM = (avgMinusDM * (period - 1) + minusDM[i]) / period;
            avgTR = (avgTR * (period - 1) + tr[i]) / period;

            const plusDI = 100 * (avgPlusDM / avgTR);
            const minusDI = 100 * (avgMinusDM / avgTR);
            const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI === 0 ? 1 : plusDI + minusDI);
            
            // Simplified ADX (would need another EMA for true ADX)
            adxArray[i] = dx;
        }
        return adxArray;
    }

    // OPTIMIZED STRATEGIES based on Phase 1 learnings
    optimizedStrategies = [
        {
            name: "MACD + ADX Filter (Optimized)",
            timeframe: "15m",
            params: { adxThreshold: 25, rsiMin: 40, rsiMax: 60 },
            run: (data, engine) => {
                const { macdLine, signalLine } = engine.calculateMACD(data);
                const ema50 = engine.calculateEMA(data, 50);
                const adx = engine.calculateADX(data, 25);
                const rsi = engine.calculateRSI(data, 14);
                let signals = [];

                for (let i = 60; i < data.length; i++) {
                    if (!macdLine[i] || !signalLine[i] || !adx[i]) continue;
                    
                    // LONG: MACD cross + ADX > 25 (strong trend) + RSI neutral (not overbought)
                    if (macdLine[i-1] <= signalLine[i-1] && macdLine[i] > signalLine[i] && 
                        adx[i] > 25 && rsi[i] > 40 && rsi[i] < 70 && data[i].close > ema50[i]) {
                        signals.push({ type: 'LONG', index: i, price: data[i].close });
                    }
                    // SHORT: MACD cross down + ADX > 25 + RSI neutral
                    else if (macdLine[i-1] >= signalLine[i-1] && macdLine[i] < signalLine[i] && 
                             adx[i] > 25 && rsi[i] < 60 && rsi[i] > 30 && data[i].close < ema50[i]) {
                        signals.push({ type: 'SHORT', index: i, price: data[i].close });
                    }
                }
                return signals;
            }
        },
        {
            name: "Multi-TF EMA Alignment",
            timeframe: "15m",
            params: {},
            run: (data, engine) => {
                const ema9 = engine.calculateEMA(data, 9);
                const ema21 = engine.calculateEMA(data, 21);
                const ema50 = engine.calculateEMA(data, 50);
                const ema200 = engine.calculateEMA(data, 200);
                let signals = [];

                for (let i = 200; i < data.length; i++) {
                    // LONG: All EMAs aligned + pullback to EMA21
                    if (ema9[i] > ema21[i] && ema21[i] > ema50[i] && ema50[i] > ema200[i]) {
                        if (data[i].low <= ema21[i] * 1.002 && data[i].close > ema21[i]) {
                            signals.push({ type: 'LONG', index: i, price: data[i].close });
                        }
                    }
                    // SHORT: All EMAs aligned down + rally to EMA21
                    else if (ema9[i] < ema21[i] && ema21[i] < ema50[i] && ema50[i] < ema200[i]) {
                        if (data[i].high >= ema21[i] * 0.998 && data[i].close < ema21[i]) {
                            signals.push({ type: 'SHORT', index: i, price: data[i].close });
                        }
                    }
                }
                return signals;
            }
        },
        {
            name: "RSI Divergence + Trend",
            timeframe: "15m",
            params: {},
            run: (data, engine) => {
                const rsi = engine.calculateRSI(data, 14);
                const ema200 = engine.calculateEMA(data, 200);
                let signals = [];

                for (let i = 20; i < data.length - 5; i++) {
                    if (!rsi[i] || !ema200[i]) continue;
                    
                    // Bullish Divergence: Price makes lower low, RSI makes higher low
                    const priceLL = data[i].low < Math.min(data[i-5].low, data[i-10].low);
                    const rsiHL = rsi[i] > Math.min(rsi[i-5] || 50, rsi[i-10] || 50);
                    
                    if (priceLL && rsiHL && data[i].close > ema200[i]) {
                        signals.push({ type: 'LONG', index: i, price: data[i].close });
                    }
                    
                    // Bearish Divergence: Price makes higher high, RSI makes lower high
                    const priceHH = data[i].high > Math.max(data[i-5].high, data[i-10].high);
                    const rsiLH = rsi[i] < Math.max(rsi[i-5] || 50, rsi[i-10] || 50);
                    
                    if (priceHH && rsiLH && data[i].close < ema200[i]) {
                        signals.push({ type: 'SHORT', index: i, price: data[i].close });
                    }
                }
                return signals;
            }
        },
        {
            name: "Volume Spike Breakout",
            timeframe: "15m",
            params: {},
            run: (data, engine) => {
                const ema50 = engine.calculateEMA(data, 50);
                let signals = [];

                for (let i = 20; i < data.length; i++) {
                    const avgVolume = data.slice(i-20, i).reduce((sum, d) => sum + d.volume, 0) / 20;
                    const volumeRatio = data[i].volume / avgVolume;
                    
                    // Volume spike > 2x average + price breakout
                    if (volumeRatio > 2.0) {
                        if (data[i].close > ema50[i] && data[i].close > data[i-1].high) {
                            signals.push({ type: 'LONG', index: i, price: data[i].close });
                        } else if (data[i].close < ema50[i] && data[i].close < data[i-1].low) {
                            signals.push({ type: 'SHORT', index: i, price: data[i].close });
                        }
                    }
                }
                return signals;
            }
        }
    ];

    async backtest(strategy) {
        console.log(`\n🧪 Optimized Test: ${strategy.name}`);
        
        const rawData = await this.fetchHistoricalData(strategy.timeframe, 2000);
        if (!rawData || rawData.length < 200) return null;

        const signals = strategy.run(rawData, this);
        if (signals.length === 0) {
            console.log("⚠️ No signals");
            return { name: strategy.name, trades: 0, profitFactor: 0 };
        }

        let balance = INITIAL_CAPITAL;
        let position = null;
        let trades = [];
        let maxDrawdown = 0;
        let peakBalance = balance;

        for (let sig of signals) {
            if (position) continue;

            const entryPrice = sig.price * (1 + (sig.type === 'LONG' ? SLIPPAGE : -SLIPPAGE));
            // Dynamic stops based on ATR approximation (2% for TP, 1% for SL as baseline)
            const stopLoss = sig.type === 'LONG' ? entryPrice * 0.985 : entryPrice * 1.015;
            const takeProfit = sig.type === 'LONG' ? entryPrice * 1.03 : entryPrice * 0.97;

            const riskPerTrade = balance * 0.02;
            const riskDistance = Math.abs(entryPrice - stopLoss);
            const positionSize = Math.min(
                (riskPerTrade / riskDistance) * LEVERAGE,
                (balance * LEVERAGE) / entryPrice
            );

            position = { type: sig.type, entry: entryPrice, size: positionSize, stop: stopLoss, target: takeProfit };

            for (let j = sig.index + 1; j < rawData.length; j++) {
                const bar = rawData[j];
                let exitPrice = null;

                if (sig.type === 'LONG') {
                    if (bar.low <= stopLoss) exitPrice = stopLoss;
                    else if (bar.high >= takeProfit) exitPrice = takeProfit;
                } else {
                    if (bar.high >= stopLoss) exitPrice = stopLoss;
                    else if (bar.low <= takeProfit) exitPrice = takeProfit;
                }

                if (!exitPrice && j === rawData.length - 1) exitPrice = bar.close;

                if (exitPrice) {
                    const fees = (positionSize * (entryPrice + exitPrice)) * FEE_RATE;
                    const grossPnL = sig.type === 'LONG' 
                        ? (exitPrice - entryPrice) * positionSize 
                        : (entryPrice - exitPrice) * positionSize;
                    const netPnL = grossPnL - fees;
                    
                    balance += netPnL;
                    if (balance > peakBalance) peakBalance = balance;
                    const dd = (peakBalance - balance) / peakBalance;
                    if (dd > maxDrawdown) maxDrawdown = dd;

                    trades.push({ pnl: netPnL, type: sig.type });
                    position = null;
                    break;
                }
            }
        }

        const winners = trades.filter(t => t.pnl > 0);
        const losers = trades.filter(t => t.pnl <= 0);
        const winRate = trades.length > 0 ? winners.length / trades.length : 0;
        const grossProfit = winners.reduce((a, t) => a + t.pnl, 0);
        const grossLoss = Math.abs(losers.reduce((a, t) => a + t.pnl, 0));
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        const totalReturn = ((balance - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

        return {
            name: strategy.name,
            trades: trades.length,
            winRate: (winRate * 100).toFixed(1),
            totalReturn: totalReturn.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            maxDrawdown: (maxDrawdown * 100).toFixed(1),
            finalBalance: balance.toFixed(2)
        };
    }

    async runOptimization() {
        console.log("\n🔍 PHASE 2: OPTIMIZED STRATEGY SEARCH\n");
        const results = [];
        
        for (const strat of this.optimizedStrategies) {
            const result = await this.backtest(strat);
            if (result) results.push(result);
            await new Promise(r => setTimeout(r, 200));
        }

        results.sort((a, b) => parseFloat(b.profitFactor) - parseFloat(a.profitFactor));
        
        console.log("\n" + "=".repeat(90));
        console.log("🏆 OPTIMIZED STRATEGY RESULTS");
        console.log("=".repeat(90));
        console.table(results);

        const winner = results[0];
        if (winner && parseFloat(winner.profitFactor) > 1.5) {
            console.log(`\n✅ ALPHA CONFIRMED: "${winner.name}"`);
            console.log(`   Profit Factor: ${winner.profitFactor} | Win Rate: ${winner.winRate}% | Return: ${winner.totalReturn}%`);
        } else {
            console.log("\n⚠️ STILL NO STRONG EDGE. Market may be inefficient or regime-dependent.");
        }

        fs.writeFileSync('./solusdt-optimized-results.json', JSON.stringify(results, null, 2));
        return results;
    }
}

const optimizer = new AlphaOptimizer();
optimizer.runOptimization().catch(console.error);
