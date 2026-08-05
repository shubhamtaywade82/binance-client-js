/**
 * Regime-Adaptive Supertrend + KNN + ADX Backtesting Engine
 * Optimized for SOLUSDT with dynamic parameter adjustment
 * 
 * Features:
 * - Regime Classification (Strong Trend, Weak Trend, Low Vol Breakout, Dead Zone)
 * - Adaptive Supertrend multipliers based on regime
 * - KNN pattern matching for signal confirmation
 * - Dynamic SL, TP, RR ratios per regime
 * - Capital allocation via simplified Kelly Criterion
 */

const https = require('https');

// Configuration
const CONFIG = {
    symbol: 'SOLUSDT',
    interval: '1h',
    days: 60,
    initialCapital: 10000,
    useRegimeAdaptive: true,
    useKNN: true,
    knnNeighbors: 5,
    knnMinWinRate: 0.55,
    
    // Regime-specific parameters
    regimes: {
        STRONG_TREND: {
            stMult: 2.0,
            adxThreshold: 25,
            slMult: 2.5,
            tpMult: 7.5,  // RR = 3.0
            capitalPct: 0.02,  // 2%
            enabled: true
        },
        WEAK_TREND: {
            stMult: 3.5,
            adxThreshold: 15,
            slMult: 1.5,
            tpMult: 2.25,  // RR = 1.5
            capitalPct: 0.005,  // 0.5%
            enabled: true
        },
        LOW_VOL_BREAKOUT: {
            stMult: 2.5,
            adxThreshold: 20,
            slMult: 2.0,
            tpMult: 4.0,  // RR = 2.0
            capitalPct: 0.01,  // 1%
            enabled: true
        },
        DEAD_ZONE: {
            stMult: 4.0,
            adxThreshold: 30,
            slMult: 1.0,
            tpMult: 1.0,  // RR = 1.0 (no trades)
            capitalPct: 0.0,  // 0%
            enabled: false
        }
    }
};

// Utility functions
function getBinanceData(symbol, interval, days) {
    return new Promise((resolve, reject) => {
        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=5000`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.map(k => ({
                        time: k[0],
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5])
                    })));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function calculateATR(data, period = 14) {
    const atr = [];
    const tr = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            tr.push(data[i].high - data[i].low);
            atr.push(null);
            continue;
        }
        
        const hl = data[i].high - data[i].low;
        const hc = Math.abs(data[i].high - data[i - 1].close);
        const lc = Math.abs(data[i].low - data[i - 1].close);
        const trueRange = Math.max(hl, hc, lc);
        tr.push(trueRange);
        
        if (i < period) {
            atr.push(null);
        } else if (i === period) {
            const sum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
            atr.push(sum / period);
        } else {
            atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
        }
    }
    
    return atr;
}

function calculateADX(data, period = 14) {
    const adx = [];
    const plusDI = [];
    const minusDI = [];
    
    const atr = calculateATR(data, period);
    
    let sumPlusDM = 0;
    let sumMinusDM = 0;
    
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            adx.push(null);
            plusDI.push(null);
            minusDI.push(null);
            continue;
        }
        
        const upMove = data[i].high - data[i - 1].high;
        const downMove = data[i - 1].low - data[i].low;
        
        let plusDM = 0;
        let minusDM = 0;
        
        if (upMove > downMove && upMove > 0) {
            plusDM = upMove;
        }
        if (downMove > upMove && downMove > 0) {
            minusDM = downMove;
        }
        
        if (i < period) {
            sumPlusDM += plusDM;
            sumMinusDM += minusDM;
            adx.push(null);
            plusDI.push(null);
            minusDI.push(null);
        } else if (i === period) {
            sumPlusDM += plusDM;
            sumMinusDM += minusDM;
            
            const pDI = (sumPlusDM / atr[i]) * 100;
            const mDI = (sumMinusDM / atr[i]) * 100;
            plusDI.push(pDI);
            minusDI.push(mDI);
            
            const dx = Math.abs(pDI - mDI) / (pDI + mDI) * 100;
            adx.push(dx);
        } else {
            sumPlusDM = sumPlusDM - sumPlusDM / period + plusDM;
            sumMinusDM = sumMinusDM - sumMinusDM / period + minusDM;
            
            const pDI = (sumPlusDM / atr[i]) * 100;
            const mDI = (sumMinusDM / atr[i]) * 100;
            plusDI.push(pDI);
            minusDI.push(mDI);
            
            const dx = Math.abs(pDI - mDI) / (pDI + mDI) * 100;
            
            // Smooth ADX
            const prevADX = adx[i - 1];
            const smoothedADX = ((prevADX * (period - 1)) + dx) / period;
            adx.push(smoothedADX);
        }
    }
    
    return { adx, plusDI, minusDI };
}

function calculateSupertrend(data, multiplier) {
    const period = 10;
    const atr = calculateATR(data, period);
    const supertrend = [];
    const direction = [];
    const finalUpper = [];
    const finalLower = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period || atr[i] === null) {
            supertrend.push(null);
            direction.push(null);
            finalUpper.push(null);
            finalLower.push(null);
            continue;
        }
        
        const hl2 = (data[i].high + data[i].low) / 2;
        const basicUpper = hl2 + (multiplier * atr[i]);
        const basicLower = hl2 - (multiplier * atr[i]);
        
        if (i === period) {
            finalUpper.push(basicUpper);
            finalLower.push(basicLower);
            direction.push(1);
            supertrend.push(finalLower[i]);
            continue;
        }
        
        // Calculate Final Upper Band
        if (basicUpper < finalUpper[i - 1] || data[i - 1].close > finalUpper[i - 1]) {
            finalUpper.push(basicUpper);
        } else {
            finalUpper.push(finalUpper[i - 1]);
        }
        
        // Calculate Final Lower Band
        if (basicLower > finalLower[i - 1] || data[i - 1].close < finalLower[i - 1]) {
            finalLower.push(basicLower);
        } else {
            finalLower.push(finalLower[i - 1]);
        }
        
        // Determine direction
        if (direction[i - 1] === 1) {
            if (data[i].close < finalLower[i - 1]) {
                direction.push(-1);
                supertrend.push(finalUpper[i]);
            } else {
                direction.push(1);
                supertrend.push(finalLower[i]);
            }
        } else {
            if (data[i].close > finalUpper[i - 1]) {
                direction.push(1);
                supertrend.push(finalLower[i]);
            } else {
                direction.push(-1);
                supertrend.push(finalUpper[i]);
            }
        }
    }
    
    return { supertrend, direction, finalUpper, finalLower, atr };
}

function classifyRegime(atrValue, adxValue, avgATR) {
    const atrRatio = atrValue / avgATR;
    
    if (adxValue >= 25 && atrRatio >= 1.2) {
        return 'STRONG_TREND';
    } else if (adxValue < 20 && atrRatio >= 1.0) {
        return 'WEAK_TREND';
    } else if (adxValue >= 15 && adxValue < 25 && atrRatio < 1.2 && atrRatio >= 0.8) {
        return 'LOW_VOL_BREAKOUT';
    } else {
        return 'DEAD_ZONE';
    }
}

function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

function knnClassify(currentFeatures, historicalData, k = 5) {
    if (historicalData.length < k) return { signal: 0, confidence: 0 };
    
    const distances = historicalData.map((hist, idx) => ({
        idx,
        distance: euclideanDistance(currentFeatures, hist.features),
        outcome: hist.outcome  // 1 for win, -1 for loss
    }));
    
    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, k);
    
    const wins = neighbors.filter(n => n.outcome === 1).length;
    const winRate = wins / k;
    
    return {
        signal: winRate > 0.5 ? 1 : -1,
        confidence: winRate,
        winRate
    };
}

async function runBacktest() {
    console.log(`🚀 Starting Regime-Adaptive Backtest for ${CONFIG.symbol}...`);
    
    const data = await getBinanceData(CONFIG.symbol, CONFIG.interval, CONFIG.days);
    console.log(`📊 Loaded ${data.length} candles`);
    
    const { adx, plusDI, minusDI } = calculateADX(data, 14);
    const avgATR = calculateATR(data, 14).filter(x => x !== null).reduce((a, b) => a + b, 0) / 
                   calculateATR(data, 14).filter(x => x !== null).length;
    
    let capital = CONFIG.initialCapital;
    let position = null;
    const trades = [];
    const historicalPatterns = [];
    
    // Store metrics per regime
    const regimeMetrics = {};
    Object.keys(CONFIG.regimes).forEach(key => {
        regimeMetrics[key] = { trades: 0, wins: 0, totalReturn: 0 };
    });
    
    for (let i = 20; i < data.length; i++) {
        const regime = classifyRegime(calculateATR(data, 14)[i], adx[i], avgATR);
        const params = CONFIG.regimes[regime];
        
        if (!params.enabled || params.capitalPct === 0) {
            if (position) {
                // Exit position if regime changes to dead zone
                const exitPrice = data[i].close;
                const pnl = position.direction === 1 ? 
                    (exitPrice - position.entry) / position.entry :
                    (position.entry - exitPrice) / position.entry;
                const profit = position.size * pnl;
                capital += profit;
                
                trades.push({
                    ...position,
                    exitPrice,
                    exitTime: data[i].time,
                    pnl,
                    profit,
                    regime
                });
                
                // Add to historical patterns for KNN
                historicalPatterns.push({
                    features: position.features,
                    outcome: pnl > 0 ? 1 : -1
                });
                
                position = null;
            }
            continue;
        }
        
        const { supertrend, direction } = calculateSupertrend(data, params.stMult);
        
        if (supertrend[i] === null || direction[i] === null) continue;
        
        // Prepare features for KNN
        const atrRatio = calculateATR(data, 14)[i] / avgATR;
        const diDiff = (plusDI[i] - minusDI[i]) / 100;
        const bodyRatio = Math.abs(data[i].close - data[i].open) / (data[i].high - data[i].low);
        const currentFeatures = [atrRatio, adx[i] / 100, diDiff, bodyRatio];
        
        // KNN confirmation
        let knnSignal = 1;
        let knnConfidence = 0.5;
        if (CONFIG.useKNN && historicalPatterns.length >= CONFIG.knnNeighbors) {
            const knnResult = knnClassify(currentFeatures, historicalPatterns, CONFIG.knnNeighbors);
            knnSignal = knnResult.signal;
            knnConfidence = knnResult.winRate;
        }
        
        // Skip if KNN confidence too low
        if (knnConfidence < CONFIG.knnMinWinRate) continue;
        
        // Entry logic
        if (!position) {
            const isBullish = direction[i] === 1 && plusDI[i] > minusDI[i] && knnSignal === 1;
            const isBearish = direction[i] === -1 && minusDI[i] > plusDI[i] && knnSignal === -1;
            
            if (isBullish || isBearish) {
                const dir = isBullish ? 1 : -1;
                const riskPct = params.capitalPct;
                const riskAmount = capital * riskPct;
                
                const entryPrice = data[i].close;
                const stopLoss = dir === 1 ? 
                    entryPrice - (calculateATR(data, 14)[i] * params.slMult) :
                    entryPrice + (calculateATR(data, 14)[i] * params.slMult);
                
                const takeProfit = dir === 1 ?
                    entryPrice + (calculateATR(data, 14)[i] * params.tpMult) :
                    entryPrice - (calculateATR(data, 14)[i] * params.tpMult);
                
                const size = riskAmount / Math.abs(entryPrice - stopLoss);
                
                position = {
                    entry: entryPrice,
                    entryTime: data[i].time,
                    direction: dir,
                    size,
                    stopLoss,
                    takeProfit,
                    regime,
                    features: currentFeatures
                };
            }
        } else {
            // Check exit conditions
            const currentPrice = data[i].close;
            let shouldExit = false;
            let exitReason = '';
            
            if (position.direction === 1) {
                if (currentPrice <= position.stopLoss) {
                    shouldExit = true;
                    exitReason = 'SL';
                } else if (currentPrice >= position.takeProfit) {
                    shouldExit = true;
                    exitReason = 'TP';
                } else if (direction[i] === -1) {
                    shouldExit = true;
                    exitReason = 'ST_REVERSAL';
                }
            } else {
                if (currentPrice >= position.stopLoss) {
                    shouldExit = true;
                    exitReason = 'SL';
                } else if (currentPrice <= position.takeProfit) {
                    shouldExit = true;
                    exitReason = 'TP';
                } else if (direction[i] === 1) {
                    shouldExit = true;
                    exitReason = 'ST_REVERSAL';
                }
            }
            
            if (shouldExit) {
                const exitPrice = currentPrice;
                const pnl = position.direction === 1 ? 
                    (exitPrice - position.entry) / position.entry :
                    (position.entry - exitPrice) / position.entry;
                const profit = position.size * pnl;
                capital += profit;
                
                trades.push({
                    ...position,
                    exitPrice,
                    exitTime: data[i].time,
                    pnl,
                    profit,
                    exitReason,
                    regime
                });
                
                // Update regime metrics
                regimeMetrics[position.regime].trades++;
                if (pnl > 0) regimeMetrics[position.regime].wins++;
                regimeMetrics[position.regime].totalReturn += pnl;
                
                // Add to historical patterns
                historicalPatterns.push({
                    features: position.features,
                    outcome: pnl > 0 ? 1 : -1
                });
                
                position = null;
            }
        }
    }
    
    // Calculate results
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const avgWin = winningTrades.length > 0 ? 
        winningTrades.reduce((a, b) => a + b.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
        Math.abs(losingTrades.reduce((a, b) => a + b.pnl, 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    const totalReturn = ((capital - CONFIG.initialCapital) / CONFIG.initialCapital) * 100;
    
    console.log('\n=== REGIME-ADAPTIVE BACKTEST RESULTS ===');
    console.log(`Symbol: ${CONFIG.symbol}`);
    console.log(`Period: ${CONFIG.days} days (${CONFIG.interval})`);
    console.log(`Initial Capital: $${CONFIG.initialCapital.toLocaleString()}`);
    console.log(`Final Capital: $${capital.toLocaleString(2)}`);
    console.log(`Total Return: ${totalReturn.toFixed(2)}%`);
    console.log(`\nTrade Statistics:`);
    console.log(`  Total Trades: ${trades.length}`);
    console.log(`  Win Rate: ${(winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor: ${profitFactor.toFixed(2)}`);
    console.log(`  Avg Win: ${(avgWin * 100).toFixed(2)}%`);
    console.log(`  Avg Loss: ${(avgLoss * 100).toFixed(2)}%`);
    
    console.log('\nPerformance by Regime:');
    Object.entries(regimeMetrics).forEach(([regime, metrics]) => {
        const wr = metrics.trades > 0 ? (metrics.wins / metrics.trades * 100) : 0;
        console.log(`  ${regime}: ${metrics.trades} trades, ${wr.toFixed(1)}% WR, ${(metrics.totalReturn * 100).toFixed(2)}% return`);
    });
    
    return {
        initialCapital: CONFIG.initialCapital,
        finalCapital: capital,
        totalReturn,
        totalTrades: trades.length,
        winRate,
        profitFactor,
        avgWin,
        avgLoss,
        trades,
        regimeMetrics
    };
}

// Run
runBacktest()
    .then(results => {
        const fs = require('fs');
        fs.writeFileSync('examples/regime-backtest-results.json', JSON.stringify(results, null, 2));
        console.log('\n✅ Results saved to examples/regime-backtest-results.json');
    })
    .catch(err => console.error('❌ Error:', err));
