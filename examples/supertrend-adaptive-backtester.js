const { BinanceFuturesClient } = require('../binance-futures-client');
require('dotenv').config();

/**
 * --- Adaptive Supertrend Backtester ---
 * This script backtests Supertrend with adaptive parameters across multiple timeframes
 * and calculates the average price movement (in %) after each signal.
 * 
 * Features:
 * 1. Multiple timeframes analysis (5m, 15m, 1h, 4h, 1d)
 * 2. Adaptive Supertrend parameters based on volatility
 * 3. Track average move after bullish and bearish signals
 * 4. Measure performance at different hold periods (1, 3, 5, 10 candles)
 * 5. Win rate and risk-reward analysis
 */

class AdaptiveSupertrendBacktester {
    constructor(config = {}) {
        this.client = new BinanceFuturesClient({
            apiKey: config.apiKey || '',
            apiSecret: config.apiSecret || '',
            testnet: config.testnet || false,
            debug: false
        });

        this.pair = config.pair || 'BTCUSDT';
        this.timeframes = config.timeframes || ['5m', '15m', '1h', '4h', '1d'];
        
        // Base Supertrend parameters
        this.basePeriod = config.period || 10;
        this.baseMultiplier = config.multiplier || 3;
        
        // ADX parameters
        this.useADXFilter = config.useADXFilter !== undefined ? config.useADXFilter : true;
        this.adxPeriod = config.adxPeriod || 14;
        this.adxThreshold = config.adxThreshold || 25; // Minimum ADX value to consider trend strong
        
        // Lookback period for historical data
        this.lookbackCandles = config.lookbackCandles || 1000;
        
        // Hold periods to analyze (in number of candles)
        this.holdPeriods = config.holdPeriods || [1, 3, 5, 10];
        
        // Results storage
        this.results = {};
    }

    /**
     * Calculate ATR (Average True Range)
     */
    calculateATR(data, period) {
        const atrValues = [];
        
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                atrValues.push(data[i].high - data[i].low);
                continue;
            }

            const trueRange = Math.max(
                data[i].high - data[i].low,
                Math.abs(data[i].high - data[i - 1].close),
                Math.abs(data[i].low - data[i - 1].close)
            );

            if (i < period) {
                // Simple average for initial values
                let sum = 0;
                for (let j = 0; j <= i; j++) {
                    sum += Math.max(
                        data[j].high - data[j].low,
                        j > 0 ? Math.abs(data[j].high - data[j - 1].close) : 0,
                        j > 0 ? Math.abs(data[j].low - data[j - 1].close) : 0
                    );
                }
                atrValues.push(sum / (i + 1));
            } else {
                // Smoothed ATR
                const prevATR = atrValues[i - 1];
                const trueRangeCurrent = Math.max(
                    data[i].high - data[i].low,
                    Math.abs(data[i].high - data[i - 1].close),
                    Math.abs(data[i].low - data[i - 1].close)
                );
                atrValues.push((prevATR * (period - 1) + trueRangeCurrent) / period);
            }
        }

        return atrValues;
    }

    /**
     * Calculate ADX (Average Directional Index)
     */
    calculateADX(data, period) {
        const plusDM = [];
        const minusDM = [];
        const tr = [];
        const plusDI = [];
        const minusDI = [];
        const dx = [];
        const adx = [];

        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                plusDM.push(0);
                minusDM.push(0);
                tr.push(data[i].high - data[i].low);
                continue;
            }

            const highDiff = data[i].high - data[i - 1].high;
            const lowDiff = data[i - 1].low - data[i].low;

            // Calculate +DM and -DM
            if (highDiff > lowDiff && highDiff > 0) {
                plusDM.push(highDiff);
            } else {
                plusDM.push(0);
            }

            if (lowDiff > highDiff && lowDiff > 0) {
                minusDM.push(lowDiff);
            } else {
                minusDM.push(0);
            }

            // Calculate True Range
            tr.push(Math.max(
                data[i].high - data[i].low,
                Math.abs(data[i].high - data[i - 1].close),
                Math.abs(data[i].low - data[i - 1].close)
            ));
        }

        // Smooth +DM, -DM, and TR
        const smoothedPlusDM = [];
        const smoothedMinusDM = [];
        const smoothedTR = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                // Simple sum for initial values
                let sumPlusDM = 0, sumMinusDM = 0, sumTR = 0;
                for (let j = 0; j <= i; j++) {
                    sumPlusDM += plusDM[j];
                    sumMinusDM += minusDM[j];
                    sumTR += tr[j];
                }
                smoothedPlusDM.push(sumPlusDM);
                smoothedMinusDM.push(sumMinusDM);
                smoothedTR.push(sumTR);
            } else {
                // Wilder's smoothing
                smoothedPlusDM.push(smoothedPlusDM[i - 1] - smoothedPlusDM[i - 1] / period + plusDM[i]);
                smoothedMinusDM.push(smoothedMinusDM[i - 1] - smoothedMinusDM[i - 1] / period + minusDM[i]);
                smoothedTR.push(smoothedTR[i - 1] - smoothedTR[i - 1] / period + tr[i]);
            }

            // Calculate +DI and -DI
            if (smoothedTR[i] > 0) {
                plusDI.push((smoothedPlusDM[i] / smoothedTR[i]) * 100);
                minusDI.push((smoothedMinusDM[i] / smoothedTR[i]) * 100);
            } else {
                plusDI.push(0);
                minusDI.push(0);
            }

            // Calculate DX
            const diSum = plusDI[i] + minusDI[i];
            if (diSum > 0) {
                dx.push(Math.abs(plusDI[i] - minusDI[i]) / diSum * 100);
            } else {
                dx.push(0);
            }

            // Calculate ADX (smoothed DX)
            if (i < period * 2) {
                // Simple average for initial ADX values
                if (i >= period) {
                    let sumDX = 0;
                    for (let j = period; j <= i; j++) {
                        sumDX += dx[j];
                    }
                    adx.push(sumDX / (i - period + 1));
                } else {
                    adx.push(null);
                }
            } else {
                // Wilder's smoothing for ADX
                adx.push((adx[i - 1] * (period - 1) + dx[i]) / period);
            }
        }

        return { plusDI, minusDI, adx };
    }

    /**
     * Calculate Adaptive Supertrend with ADX filter
     * Adapts multiplier based on market volatility and filters signals by trend strength
     */
    calculateAdaptiveSupertrend(data, basePeriod, baseMultiplier) {
        const atrValues = this.calculateATR(data, basePeriod);
        const { plusDI, minusDI, adx } = this.calculateADX(data, this.adxPeriod);
        const trend = [];
        const upperBand = [];
        const lowerBand = [];
        const supertrendValues = [];
        const adaptiveMultipliers = [];
        const adxValues = [];

        // Calculate volatility-based adaptive multiplier
        const avgATR = atrValues.slice(basePeriod).reduce((a, b) => a + b, 0) / (atrValues.length - basePeriod);
        
        for (let i = 0; i < data.length; i++) {
            if (i < basePeriod || i < this.adxPeriod * 2) {
                trend.push(null);
                upperBand.push(null);
                lowerBand.push(null);
                supertrendValues.push(null);
                adaptiveMultipliers.push(null);
                adxValues.push(null);
                continue;
            }

            // Store ADX value
            adxValues.push(adx[i]);

            // Adaptive multiplier: increase in high volatility, decrease in low volatility
            const currentATR = atrValues[i];
            const volatilityRatio = currentATR / avgATR;
            
            // Adjust multiplier based on volatility (range: baseMultiplier * 0.7 to baseMultiplier * 1.3)
            let adaptiveMultiplier = baseMultiplier * (1 + (volatilityRatio - 1) * 0.3);
            adaptiveMultiplier = Math.max(baseMultiplier * 0.7, Math.min(baseMultiplier * 1.3, adaptiveMultiplier));
            adaptiveMultipliers.push(adaptiveMultiplier);

            const median = (data[i].high + data[i].low) / 2;
            const atr = atrValues[i];

            let ub = median + (adaptiveMultiplier * atr);
            let lb = median - (adaptiveMultiplier * atr);

            // Band tightening logic
            if (i > basePeriod) {
                if (lowerBand[i - 1] !== null) {
                    lb = lb > lowerBand[i - 1] || data[i - 1].close < lowerBand[i - 1] ? lb : lowerBand[i - 1];
                }
                if (upperBand[i - 1] !== null) {
                    ub = ub < upperBand[i - 1] || data[i - 1].close > upperBand[i - 1] ? ub : upperBand[i - 1];
                }
            }

            lowerBand.push(lb);
            upperBand.push(ub);

            let t;
            if (!trend[i - 1] || trend[i - 1] === null) {
                t = 1;
            } else if (trend[i - 1] === 1) {
                t = data[i].close < lowerBand[i] ? -1 : 1;
            } else {
                t = data[i].close > upperBand[i] ? 1 : -1;
            }
            
            // Apply ADX filter: only accept signal if ADX indicates strong trend
            if (this.useADXFilter && adx[i] !== null && adx[i] < this.adxThreshold) {
                // Keep previous trend if ADX is too weak
                t = trend[i - 1];
            }
            
            trend.push(t);
            supertrendValues.push(t === 1 ? lowerBand[i] : upperBand[i]);
        }

        return {
            trend,
            upperBand,
            lowerBand,
            supertrendValues,
            adaptiveMultipliers,
            atr: atrValues,
            adx: adxValues,
            plusDI,
            minusDI
        };
    }

    /**
     * Fetch historical K-line data
     */
    async fetchHistoricalData(timeframe) {
        console.log(`📥 Fetching ${this.lookbackCandles} candles for ${this.pair} (${timeframe})...`);
        
        try {
            const klines = await this.client.getKlines(this.pair, timeframe, { 
                limit: this.lookbackCandles 
            });

            const data = klines.map(k => ({
                timestamp: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));

            console.log(`✅ Loaded ${data.length} candles from ${new Date(data[0].timestamp).toISOString()} to ${new Date(data[data.length - 1].timestamp).toISOString()}`);
            return data;
        } catch (error) {
            console.error(`❌ Error fetching data for ${timeframe}:`, error.message);
            throw error;
        }
    }

    /**
     * Detect signal flips (trend changes)
     */
    detectSignals(trend) {
        const signals = [];
        
        for (let i = 1; i < trend.length; i++) {
            if (trend[i] !== null && trend[i - 1] !== null && trend[i] !== trend[i - 1]) {
                signals.push({
                    index: i,
                    type: trend[i] === 1 ? 'BULLISH' : 'BEARISH',
                    previousTrend: trend[i - 1],
                    newTrend: trend[i]
                });
            }
        }

        return signals;
    }

    /**
     * Calculate price movement after signals
     */
    calculatePostSignalMoves(data, signals, holdPeriods) {
        const results = {
            BULLISH: {},
            BEARISH: {}
        };

        holdPeriods.forEach(hp => {
            results.BULLISH[hp] = [];
            results.BEARISH[hp] = [];
        });

        signals.forEach(signal => {
            const entryIndex = signal.index;
            const entryPrice = data[entryIndex].close;

            holdPeriods.forEach(hp => {
                const exitIndex = entryIndex + hp;
                
                if (exitIndex < data.length) {
                    const exitPrice = data[exitIndex].close;
                    
                    // Calculate percentage move
                    let pctMove;
                    if (signal.type === 'BULLISH') {
                        pctMove = ((exitPrice - entryPrice) / entryPrice) * 100;
                    } else {
                        pctMove = ((entryPrice - exitPrice) / entryPrice) * 100;
                    }

                    results[signal.type][hp].push({
                        signalIndex: entryIndex,
                        entryPrice,
                        exitPrice,
                        pctMove,
                        timestamp: data[entryIndex].timestamp,
                        isWin: pctMove > 0
                    });
                }
            });
        });

        return results;
    }

    /**
     * Analyze results and calculate statistics
     */
    analyzeResults(postSignalMoves) {
        const stats = {
            BULLISH: {},
            BEARISH: {}
        };

        ['BULLISH', 'BEARISH'].forEach(signalType => {
            Object.keys(postSignalMoves[signalType]).forEach(hp => {
                const moves = postSignalMoves[signalType][hp];
                
                if (moves.length === 0) {
                    stats[signalType][hp] = {
                        count: 0,
                        avgMove: 0,
                        winRate: 0,
                        avgWin: 0,
                        avgLoss: 0,
                        profitFactor: 0,
                        maxWin: 0,
                        maxLoss: 0
                    };
                    return;
                }

                const wins = moves.filter(m => m.isWin);
                const losses = moves.filter(m => !m.isWin);
                
                const totalPnL = moves.reduce((sum, m) => sum + m.pctMove, 0);
                const avgMove = totalPnL / moves.length;
                
                const avgWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w.pctMove, 0) / wins.length : 0;
                const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l.pctMove, 0) / losses.length : 0;
                
                const totalWins = wins.reduce((sum, w) => sum + w.pctMove, 0);
                const totalLosses = Math.abs(losses.reduce((sum, l) => sum + l.pctMove, 0));
                
                const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

                const pctMoves = moves.map(m => m.pctMove);
                const maxWin = Math.max(...pctMoves);
                const maxLoss = Math.min(...pctMoves);

                stats[signalType][hp] = {
                    count: moves.length,
                    avgMove: avgMove,
                    winRate: (wins.length / moves.length) * 100,
                    avgWin: avgWin,
                    avgLoss: avgLoss,
                    profitFactor: profitFactor,
                    maxWin: maxWin,
                    maxLoss: maxLoss,
                    totalPnL: totalPnL
                };
            });
        });

        return stats;
    }

    /**
     * Run backtest for a single timeframe
     */
    async backtestTimeframe(timeframe) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 BACKTESTING ${timeframe} TIMEFRAME`);
        console.log(`${'='.repeat(80)}`);

        const data = await this.fetchHistoricalData(timeframe);
        
        // Calculate adaptive Supertrend with ADX
        const { trend, adaptiveMultipliers, atr, adx } = this.calculateAdaptiveSupertrend(
            data, 
            this.basePeriod, 
            this.baseMultiplier
        );

        // Detect signals
        const signals = this.detectSignals(trend);
        console.log(`📊 Detected ${signals.length} signals (${signals.filter(s => s.type === 'BULLISH').length} Bullish, ${signals.filter(s => s.type === 'BEARISH').length} Bearish)`);
        
        if (this.useADXFilter) {
            const validADX = adx.filter(a => a !== null);
            const avgADX = validADX.length > 0 ? validADX.reduce((a, b) => a + b, 0) / validADX.length : 0;
            console.log(`📈 ADX Filter: ON (Threshold: ${this.adxThreshold}, Avg ADX: ${avgADX.toFixed(2)})`);
        } else {
            console.log(`📈 ADX Filter: OFF`);
        }

        // Calculate post-signal moves
        const postSignalMoves = this.calculatePostSignalMoves(data, signals, this.holdPeriods);

        // Analyze results
        const stats = this.analyzeResults(postSignalMoves);

        // Calculate average ADX at signal points
        const signalADX = signals.map(s => adx[s.index]).filter(a => a !== null);
        const avgADXAtSignals = signalADX.length > 0 ? signalADX.reduce((a, b) => a + b, 0) / signalADX.length : 0;

        // Store results
        this.results[timeframe] = {
            totalCandles: data.length,
            signalCount: signals.length,
            bullishSignals: signals.filter(s => s.type === 'BULLISH').length,
            bearishSignals: signals.filter(s => s.type === 'BEARISH').length,
            avgAdaptiveMultiplier: adaptiveMultipliers.filter(m => m !== null).reduce((a, b) => a + b, 0) / adaptiveMultipliers.filter(m => m !== null).length,
            avgATR: atr.slice(this.basePeriod).reduce((a, b) => a + b, 0) / atr.slice(this.basePeriod).length,
            adxFilterEnabled: this.useADXFilter,
            adxThreshold: this.adxThreshold,
            avgADX: adx.filter(a => a !== null).reduce((a, b) => a + b, 0) / adx.filter(a => a !== null).length,
            avgADXAtSignals: avgADXAtSignals,
            statistics: stats,
            signals: signals.map(s => ({
                ...s,
                price: data[s.index].close,
                adx: adx[s.index],
                timestamp: new Date(data[s.index].timestamp).toISOString()
            }))
        };

        return this.results[timeframe];
    }

    /**
     * Run backtest across all timeframes
     */
    async runBacktest() {
        console.log(`${'='.repeat(80)}`);
        console.log(`🚀 ADAPTIVE SUPERTREND + ADX BACKTESTER`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Pair: ${this.pair}`);
        console.log(`Timeframes: ${this.timeframes.join(', ')}`);
        console.log(`Base Period: ${this.basePeriod}`);
        console.log(`Base Multiplier: ${this.baseMultiplier}`);
        console.log(`ADX Filter: ${this.useADXFilter ? 'ON' : 'OFF'}${this.useADXFilter ? ` (Threshold: ${this.adxThreshold})` : ''}`);
        console.log(`Lookback: ${this.lookbackCandles} candles`);
        console.log(`Hold Periods: ${this.holdPeriods.join(', ')} candles`);
        console.log(`${'='.repeat(80)}\n`);

        for (const timeframe of this.timeframes) {
            try {
                await this.backtestTimeframe(timeframe);
            } catch (error) {
                console.error(`❌ Error backtesting ${timeframe}:`, error.message);
                this.results[timeframe] = { error: error.message };
            }
        }

        return this.results;
    }

    /**
     * Print formatted results
     */
    printResults() {
        console.log(`\n\n${'='.repeat(100)}`);
        console.log(`📈 BACKTEST RESULTS SUMMARY`);
        console.log(`${'='.repeat(100)}`);

        Object.keys(this.results).forEach(timeframe => {
            const result = this.results[timeframe];
            
            if (result.error) {
                console.log(`\n⚠️  ${timeframe}: ERROR - ${result.error}`);
                return;
            }

            console.log(`\n${'-'.repeat(100)}`);
            console.log(`⏰ TIMEFRAME: ${timeframe}`);
            console.log(`${'-'.repeat(100)}`);
            console.log(`Total Candles: ${result.totalCandles}`);
            console.log(`Total Signals: ${result.signalCount} (${result.bullishSignals} Bullish | ${result.bearishSignals} Bearish)`);
            console.log(`Avg Adaptive Multiplier: ${result.avgAdaptiveMultiplier.toFixed(3)}`);
            console.log(`Avg ATR: ${result.avgATR.toFixed(4)}`);

            console.log(`\n📊 BULLISH SIGNALS PERFORMANCE:`);
            console.log(`${'─'.repeat(100)}`);
            console.log(`Hold Period | Count | Avg Move % | Win Rate % | Avg Win % | Avg Loss % | Profit Factor | Max Win % | Max Loss %`);
            console.log(`${'─'.repeat(100)}`);
            
            Object.keys(result.statistics.BULLISH).forEach(hp => {
                const stat = result.statistics.BULLISH[hp];
                console.log(`${String(hp).padEnd(11)} | ${String(stat.count).padEnd(5)} | ${stat.avgMove.toFixed(4).padEnd(10)} | ${stat.winRate.toFixed(2).padEnd(10)} | ${stat.avgWin.toFixed(4).padEnd(9)} | ${stat.avgLoss.toFixed(4).padEnd(10)} | ${stat.profitFactor.toFixed(2).padEnd(13)} | ${stat.maxWin.toFixed(4).padEnd(9)} | ${stat.maxLoss.toFixed(4)}`);
            });

            console.log(`\n📊 BEARISH SIGNALS PERFORMANCE:`);
            console.log(`${'─'.repeat(100)}`);
            console.log(`Hold Period | Count | Avg Move % | Win Rate % | Avg Win % | Avg Loss % | Profit Factor | Max Win % | Max Loss %`);
            console.log(`${'─'.repeat(100)}`);
            
            Object.keys(result.statistics.BEARISH).forEach(hp => {
                const stat = result.statistics.BEARISH[hp];
                console.log(`${String(hp).padEnd(11)} | ${String(stat.count).padEnd(5)} | ${stat.avgMove.toFixed(4).padEnd(10)} | ${stat.winRate.toFixed(2).padEnd(10)} | ${stat.avgWin.toFixed(4).padEnd(9)} | ${stat.avgLoss.toFixed(4).padEnd(10)} | ${stat.profitFactor.toFixed(2).padEnd(13)} | ${stat.maxWin.toFixed(4).padEnd(9)} | ${stat.maxLoss.toFixed(4)}`);
            });
        });

        console.log(`\n${'='.repeat(100)}`);
        console.log(`✅ Backtest Complete!`);
        console.log(`${'='.repeat(100)}\n`);
    }

    /**
     * Save results to JSON file
     */
    saveResults(filename = 'supertrend-adaptive-backtest-results.json') {
        const fs = require('fs');
        const path = require('path');
        
        const outputPath = path.join(__dirname, filename);
        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Results saved to: ${outputPath}`);
    }
}

// Main execution
async function main() {
    const backtester = new AdaptiveSupertrendBacktester({
        pair: 'BTCUSDT',
        timeframes: ['5m', '15m', '1h', '4h', '1d'],
        period: 10,
        multiplier: 3,
        useADXFilter: true,      // Enable ADX filter to avoid weak trends
        adxPeriod: 14,            // Standard ADX period
        adxThreshold: 25,         // Only trade when ADX > 25 (strong trend)
        lookbackCandles: 1000,
        holdPeriods: [1, 3, 5, 10]
    });

    await backtester.runBacktest();
    backtester.printResults();
    backtester.saveResults();
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AdaptiveSupertrendBacktester };
