/**
 * SOLUSDT Strategy Backtester & Alpha Finder
 * Tests multiple trend-following strategies to find which generates edge and alpha
 * Uses public Binance APIs for historical data (no API keys required for backtesting)
 */

const axios = require('axios');
const BINANCE_API = 'https://fapi.binance.com/fapi/v1';

// Configuration
const CONFIG = {
    symbol: 'SOLUSDT',
    leverage: 10,
    initialCapital: 10000, // $10,000 test capital
    timeframes: ['5m', '15m', '1h'],
    daysToTest: 30,
    klinesLimit: 1000
};

// Strategy definitions to test
const STRATEGIES = {
    // Strategy 1: Multi-timeframe EMA Trend Following
    'MTF_EMA_TREND': {
        name: 'Multi-Timeframe EMA Trend',
        description: 'Uses EMA crossovers across 3 timeframes with ADX confirmation',
        params: {
            emaFast: 9,
            emaSlow: 21,
            emaMajor: 50,
            adxThreshold: 25,
            rsiPeriod: 14,
            rsiLong: 50,
            rsiShort: 50
        },
        entry: (data, indicators) => {
            const { tf5m, tf15m, tf1h } = indicators;
            // LONG conditions
            if (tf1h.close > tf1h.ema50 && tf1h.adx > 25 &&
                tf15m.ema9 > tf15m.ema21 && tf15m.rsi > 50 &&
                tf5m.ema9 > tf5m.ema21 && tf5m.macd > 0 && tf5m.adx > 25) {
                return 'LONG';
            }
            // SHORT conditions
            if (tf1h.close < tf1h.ema50 && tf1h.adx > 25 &&
                tf15m.ema9 < tf15m.ema21 && tf15m.rsi < 50 &&
                tf5m.ema9 < tf5m.ema21 && tf5m.macd < 0 && tf5m.adx > 25) {
                return 'SHORT';
            }
            return null;
        }
    },

    // Strategy 2: ADX Momentum Breakout
    'ADX_MOMENTUM': {
        name: 'ADX Momentum Breakout',
        description: 'Enters when ADX shows strong trend + price breakout',
        params: {
            adxStrong: 30,
            lookbackPeriod: 20,
            atrMultiplier: 1.5
        },
        entry: (data, indicators) => {
            const { tf15m } = indicators;
            const rangeHigh = Math.max(...data.slice(-20).map(d => d.high));
            const rangeLow = Math.min(...data.slice(-20).map(d => d.low));
            
            if (tf15m.adx > 30 && data[data.length - 1].close > rangeHigh) {
                return 'LONG';
            }
            if (tf15m.adx > 30 && data[data.length - 1].close < rangeLow) {
                return 'SHORT';
            }
            return null;
        }
    },

    // Strategy 3: RSI Divergence with Trend Filter
    'RSI_DIVERGENCE': {
        name: 'RSI Divergence with Trend Filter',
        description: 'Finds RSI divergences in direction of major trend',
        params: {
            rsiOversold: 30,
            rsiOverbought: 70,
            divergenceLookback: 5
        },
        entry: (data, indicators) => {
            const { tf1h, tf15m } = indicators;
            const rsi = tf15m.rsi;
            
            // Bullish divergence in uptrend
            if (tf1h.close > tf1h.ema50 && rsi < 35) {
                return 'LONG';
            }
            // Bearish divergence in downtrend
            if (tf1h.close < tf1h.ema50 && rsi > 65) {
                return 'SHORT';
            }
            return null;
        }
    },

    // Strategy 4: MACD Crossover with Volume
    'MACD_VOLUME': {
        name: 'MACD Crossover with Volume',
        description: 'MACD signal crossovers confirmed by volume spike',
        params: {
            macdFast: 12,
            macdSlow: 26,
            macdSignal: 9,
            volumeMultiplier: 1.5
        },
        entry: (data, indicators) => {
            const { tf15m, tf5m } = indicators;
            const avgVolume = data.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20;
            const currentVolume = data[data.length - 1].volume;
            
            if (tf5m.macd > tf5m.macdSignal && currentVolume > avgVolume * 1.5) {
                return 'LONG';
            }
            if (tf5m.macd < tf5m.macdSignal && currentVolume > avgVolume * 1.5) {
                return 'SHORT';
            }
            return null;
        }
    },

    // Strategy 5: Simple Moving Average Crossover
    'SMA_CROSSOVER': {
        name: 'Simple SMA Crossover',
        description: 'Classic golden/death cross on 15m timeframe',
        params: {
            smaFast: 20,
            smaSlow: 50
        },
        entry: (data, indicators) => {
            const { tf15m } = indicators;
            if (tf15m.sma20 > tf15m.sma50) {
                return 'LONG';
            }
            if (tf15m.sma20 < tf15m.sma50) {
                return 'SHORT';
            }
            return null;
        }
    },

    // Strategy 6: ATR Breakout Channel
    'ATR_BREAKOUT': {
        name: 'ATR Breakout Channel',
        description: 'Breakout above/below ATR-based channels',
        params: {
            atrPeriod: 14,
            atrMultiplier: 2.0,
            channelPeriod: 20
        },
        entry: (data, indicators) => {
            const { tf15m } = indicators;
            const closes = data.slice(-20).map(d => d.close);
            const highestClose = Math.max(...closes);
            const lowestClose = Math.min(...closes);
            const upperChannel = highestClose + (tf15m.atr * 2);
            const lowerChannel = lowestClose - (tf15m.atr * 2);
            
            if (data[data.length - 1].close > upperChannel) {
                return 'LONG';
            }
            if (data[data.length - 1].close < lowerChannel) {
                return 'SHORT';
            }
            return null;
        }
    }
};

// Technical Indicator Calculations
function calculateEMA(data, period) {
    if (data.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
    for (let i = period; i < data.length; i++) {
        ema = (data[i].close - ema) * multiplier + ema;
    }
    return ema;
}

function calculateSMA(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((sum, d) => sum + d.close, 0) / period;
}

function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
    if (data.length < slow + signal) return { macd: null, signal: null, histogram: null };
    
    const emaFast = calculateEMA(data, fast);
    const emaSlow = calculateEMA(data, slow);
    if (emaFast === null || emaSlow === null) return { macd: null, signal: null, histogram: null };
    
    const macdLine = emaFast - emaSlow;
    
    // Calculate signal line (simplified - would need historical MACD values)
    const signalLine = macdLine * 0.8; // Simplified approximation
    const histogram = macdLine - signalLine;
    
    return { macd: macdLine, signal: signalLine, histogram };
}

function calculateADX(data, period = 14) {
    if (data.length < period + 1) return null;
    
    let trSum = 0, plusDMSum = 0, minusDMSum = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;
        
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
        
        const plusDM = high - data[i - 1].high > data[i - 1].low - low ? 
            Math.max(high - data[i - 1].high, 0) : 0;
        const minusDM = data[i - 1].low - low > high - data[i - 1].high ? 
            Math.max(data[i - 1].low - low, 0) : 0;
        
        plusDMSum += plusDM;
        minusDMSum += minusDM;
    }
    
    const atr = trSum / period;
    const plusDI = (plusDMSum / trSum) * 100;
    const minusDI = (minusDMSum / trSum) * 100;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    // Simplified ADX (would need smoothing for accurate calculation)
    return dx * 0.7; // Approximation factor
}

function calculateATR(data, period = 14) {
    if (data.length < period + 1) return null;
    
    let trSum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
    }
    
    return trSum / period;
}

// Fetch historical klines from Binance
async function fetchKlines(symbol, interval, limit = 1000) {
    try {
        const url = `${BINANCE_API}/klines`;
        const params = { symbol, interval, limit };
        const response = await axios.get(url, { params });
        
        return response.data.map(k => ({
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
    } catch (error) {
        console.error(`Error fetching ${symbol} ${interval} klines:`, error.message);
        return null;
    }
}

// Calculate indicators for a dataset
function calculateIndicators(data) {
    return {
        ema9: calculateEMA(data, 9),
        ema21: calculateEMA(data, 21),
        ema50: calculateEMA(data, 50),
        sma20: calculateSMA(data, 20),
        sma50: calculateSMA(data, 50),
        rsi: calculateRSI(data, 14),
        macd: calculateMACD(data).macd,
        macdSignal: calculateMACD(data).signal,
        adx: calculateADX(data, 14),
        atr: calculateATR(data, 14)
    };
}

// Backtest a single strategy
async function backtestStrategy(strategyName, strategy) {
    console.log(`\n📊 Backtesting: ${strategy.name}`);
    console.log(`   ${strategy.description}`);
    
    // Fetch data for all timeframes
    const [data5m, data15m, data1h] = await Promise.all([
        fetchKlines(CONFIG.symbol, '5m', CONFIG.klinesLimit),
        fetchKlines(CONFIG.symbol, '15m', CONFIG.klinesLimit),
        fetchKlines(CONFIG.symbol, '1h', CONFIG.klinesLimit)
    ]);
    
    if (!data5m || !data15m || !data1h) {
        console.log('   ❌ Failed to fetch data');
        return null;
    }
    
    console.log(`   📈 Data points: 5m=${data5m.length}, 15m=${data15m.length}, 1h=${data1h.length}`);
    
    let capital = CONFIG.initialCapital;
    let position = null; // { type: 'LONG'|'SHORT', entryPrice: number, size: number }
    let trades = [];
    let wins = 0, losses = 0;
    let maxDrawdown = 0;
    let peakCapital = capital;
    
    const leverage = CONFIG.leverage;
    const tpPercent = 0.02; // 2% take profit
    const slPercent = 0.01; // 1% stop loss
    
    // Simulate trading through the data
    const startIndex = 100; // Skip first 100 candles for indicator warmup
    const endIndex = Math.min(data15m.length - 50, Math.floor(data5m.length / 3) - 50, Math.floor(data1h.length * 4) - 50);
    
    for (let i = startIndex; i < endIndex; i++) {
        // Get aligned data points (approximate alignment)
        const tf5mData = data5m.slice(Math.max(0, i * 3 - 50), i * 3 + 1);
        const tf15mCurrent = data15m[i];
        const tf1hCurrent = data1h[Math.floor(i / 4)];
        
        if (!tf5mData || tf5mData.length < 50 || !tf15mCurrent || !tf1hCurrent) continue;
        
        const indicators = {
            tf5m: calculateIndicators(tf5mData),
            tf15m: calculateIndicators(data15m.slice(Math.max(0, i - 50), i + 1)),
            tf1h: calculateIndicators(data1h.slice(Math.max(0, Math.floor(i / 4) - 50), Math.floor(i / 4) + 1))
        };
        
        const currentPrice = tf15mCurrent.close;
        
        // Check for exit conditions
        if (position) {
            const priceChange = position.type === 'LONG' ? 
                (currentPrice - position.entryPrice) / position.entryPrice :
                (position.entryPrice - currentPrice) / position.entryPrice;
            
            // Take Profit
            if (priceChange >= tpPercent) {
                const pnl = capital * priceChange * leverage;
                capital += pnl;
                trades.push({ type: position.type, result: 'WIN', pnl, entry: position.entryPrice, exit: currentPrice });
                wins++;
                position = null;
            }
            // Stop Loss
            else if (priceChange <= -slPercent) {
                const pnl = capital * priceChange * leverage;
                capital += pnl;
                trades.push({ type: position.type, result: 'LOSS', pnl, entry: position.entryPrice, exit: currentPrice });
                losses++;
                position = null;
            }
        }
        
        // Check for entry signals
        if (!position) {
            const signal = strategy.entry(data15m.slice(Math.max(0, i - 50), i + 1), indicators);
            if (signal) {
                position = {
                    type: signal,
                    entryPrice: currentPrice,
                    size: (capital * leverage) / currentPrice
                };
            }
        }
        
        // Track drawdown
        if (capital > peakCapital) {
            peakCapital = capital;
        }
        const drawdown = (peakCapital - capital) / peakCapital;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }
    
    // Close any open position at the end
    if (position) {
        const finalPrice = data15m[data15m.length - 1].close;
        const priceChange = position.type === 'LONG' ? 
            (finalPrice - position.entryPrice) / position.entryPrice :
            (position.entryPrice - finalPrice) / position.entryPrice;
        const pnl = capital * priceChange * leverage;
        capital += pnl;
        trades.push({ type: position.type, result: 'CLOSE', pnl, entry: position.entryPrice, exit: finalPrice });
        if (pnl > 0) wins++; else losses++;
    }
    
    // Calculate metrics
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
    const totalReturn = ((capital - CONFIG.initialCapital) / CONFIG.initialCapital) * 100;
    const avgWin = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / (wins || 1);
    const avgLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / (losses || 1));
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : 0;
    const sharpeRatio = totalReturn / (maxDrawdown * 100 || 1); // Simplified Sharpe
    
    return {
        name: strategy.name,
        totalTrades,
        wins,
        losses,
        winRate: winRate.toFixed(2),
        totalReturn: totalReturn.toFixed(2),
        finalCapital: capital.toFixed(2),
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2),
        sharpeRatio: sharpeRatio.toFixed(2),
        trades
    };
}

// Main execution
async function main() {
    console.log('🚀 SOLUSDT Strategy Backtester & Alpha Finder');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Symbol: ${CONFIG.symbol}`);
    console.log(`   Leverage: ${CONFIG.leverage}x`);
    console.log(`   Initial Capital: $${CONFIG.initialCapital.toLocaleString()}`);
    console.log(`   Testing Period: Last ${CONFIG.daysToTest} days`);
    console.log(`   Strategies to Test: ${Object.keys(STRATEGIES).length}`);
    console.log('═══════════════════════════════════════════════\n');
    
    const results = [];
    
    // Test each strategy
    for (const [key, strategy] of Object.entries(STRATEGIES)) {
        try {
            const result = await backtestStrategy(key, strategy);
            if (result) {
                results.push(result);
            }
        } catch (error) {
            console.error(`   ❌ Error testing ${strategy.name}:`, error.message);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Display results summary
    console.log('\n\n📊 RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════════════════');
    console.log(
        'Strategy'.padEnd(35),
        'Trades'.padStart(8),
        'Win%'.padStart(8),
        'Return%'.padStart(10),
        'Profit Factor'.padStart(14),
        'Max DD%'.padStart(10),
        'Sharpe'.padStart(8)
    );
    console.log('─'.repeat(105));
    
    // Sort by total return
    results.sort((a, b) => parseFloat(b.totalReturn) - parseFloat(a.totalReturn));
    
    for (const result of results) {
        console.log(
            result.name.padEnd(35),
            result.totalTrades.toString().padStart(8),
            result.winRate.padStart(8),
            result.totalReturn.padStart(10),
            result.profitFactor.padStart(14),
            result.maxDrawdown.padStart(10),
            result.sharpeRatio.padStart(8)
        );
    }
    
    console.log('═'.repeat(105));
    
    // Find best strategy
    const bestStrategy = results.reduce((best, current) => 
        parseFloat(current.totalReturn) > parseFloat(best.totalReturn) ? current : best
    );
    
    const bestBySharpe = results.reduce((best, current) => 
        parseFloat(current.sharpeRatio) > parseFloat(best.sharpeRatio) ? current : best
    );
    
    const bestByProfitFactor = results.reduce((best, current) => 
        parseFloat(current.profitFactor) > parseFloat(best.profitFactor) ? current : best
    );
    
    console.log('\n🏆 TOP PERFORMERS');
    console.log('───────────────────────────────────────────────────────────────────────────────────────');
    console.log(`🥇 Highest Return:     ${bestStrategy.name}`);
    console.log(`   Return: ${bestStrategy.totalReturn}% | Win Rate: ${bestStrategy.winRate}% | Trades: ${bestStrategy.totalTrades}`);
    console.log('');
    console.log(`🎯 Best Risk-Adjusted: ${bestBySharpe.name}`);
    console.log(`   Sharpe Ratio: ${bestBySharpe.sharpeRatio} | Return: ${bestBySharpe.totalReturn}% | Max DD: ${bestBySharpe.maxDrawdown}%`);
    console.log('');
    console.log(`💰 Best Profit Factor: ${bestByProfitFactor.name}`);
    console.log(`   Profit Factor: ${bestByProfitFactor.profitFactor} | Win Rate: ${bestByProfitFactor.winRate}%`);
    
    console.log('\n✨ EDGE & ALPHA ANALYSIS');
    console.log('───────────────────────────────────────────────────────────────────────────────────────');
    
    // Identify strategies with positive alpha (return > 0)
    const positiveAlpha = results.filter(r => parseFloat(r.totalReturn) > 0);
    if (positiveAlpha.length > 0) {
        console.log(`✅ Strategies with Positive Alpha: ${positiveAlpha.length}/${results.length}`);
        positiveAlpha.forEach(r => {
            console.log(`   • ${r.name}: ${r.totalReturn}% return`);
        });
    } else {
        console.log('❌ No strategies generated positive alpha in this test period');
    }
    
    // Identify strategies with statistical edge (profit factor > 1.5)
    const withEdge = results.filter(r => parseFloat(r.profitFactor) > 1.5);
    if (withEdge.length > 0) {
        console.log(`\n✅ Strategies with Statistical Edge (PF > 1.5): ${withEdge.length}`);
        withEdge.forEach(r => {
            console.log(`   • ${r.name}: PF=${r.profitFactor}, Win Rate=${r.winRate}%`);
        });
    }
    
    console.log('\n⚠️  DISCLAIMER');
    console.log('───────────────────────────────────────────────────────────────────────────────────────');
    console.log('• Backtesting results do not guarantee future performance');
    console.log('• Transaction fees, slippage, and funding rates not included');
    console.log('• Market conditions change - continuously monitor and adapt strategies');
    console.log('• Always use proper risk management and never risk more than you can afford to lose');
    console.log('');
}

main().catch(console.error);
