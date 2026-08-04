const { BinanceFuturesClient } = require('../binance-futures-client');
const { EMA, RSI, MACD, ADX, ATR } = require('technicalindicators');
require('dotenv').config();

/**
 * --- SOLUSDT Multi-Timeframe Trend Strategy Builder ---
 * 
 * Strategy Overview:
 * - Uses 3 timeframes for trend confirmation: 5m (entry), 15m (intermediate), 1h (major trend)
 * - Combines multiple indicators: EMA crossover, ADX for trend strength, RSI for momentum, MACD for confirmation
 * - 10x leverage position sizing with dynamic risk management
 * - Works in both LONG and SHORT trending markets
 * 
 * Entry Conditions (LONG):
 * 1. 1h timeframe: Price above EMA(50) AND ADX > 25 (strong trend)
 * 2. 15m timeframe: EMA(9) > EMA(21) AND RSI > 50
 * 3. 5m timeframe: EMA(9) crosses above EMA(21) AND MACD histogram turns positive
 * 4. ADX(14) > 25 on 5m (confirms strong trend)
 * 
 * Entry Conditions (SHORT):
 * 1. 1h timeframe: Price below EMA(50) AND ADX > 25 (strong trend)
 * 2. 15m timeframe: EMA(9) < EMA(21) AND RSI < 50
 * 3. 5m timeframe: EMA(9) crosses below EMA(21) AND MACD histogram turns negative
 * 4. ADX(14) > 25 on 5m (confirms strong trend)
 * 
 * Exit Conditions:
 * - Take Profit: 2% move in favor (20% with 10x leverage)
 * - Stop Loss: 1% move against (10% with 10x leverage)
 * - Trailing Stop: Activates after 1% profit, trails by 0.5%
 * - Emergency exit: ADX drops below 20 (trend weakening)
 * 
 * Risk Management:
 * - Position size: 10% of account per trade (with 10x leverage = 100% exposure)
 * - Max 2 concurrent positions
 * - Daily loss limit: 5% of account
 * - Cooldown period: 15 minutes after each trade
 */

class SOLUSDTTrendStrategyBuilder {
    constructor(config) {
        this.client = new BinanceFuturesClient({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            testnet: config.testnet,
            debug: false
        });

        this.pair = config.pair || 'SOLUSDT';
        this.leverage = config.leverage || 10;
        
        // Timeframes
        this.timeframes = {
            entry: '5m',
            intermediate: '15m',
            major: '1h'
        };

        // Indicator parameters
        this.indicatorParams = {
            emaFast: 9,
            emaSlow: 21,
            emaMajor: 50,
            rsiPeriod: 14,
            macdFast: 12,
            macdSlow: 26,
            macdSignal: 9,
            adxPeriod: 14,
            atrPeriod: 14
        };

        // Risk management
        this.riskParams = {
            takeProfit: 0.02,      // 2% price move
            stopLoss: 0.01,        // 1% price move
            trailingStopActivation: 0.01,  // Activate after 1% profit
            trailingStopDistance: 0.005,   // Trail by 0.5%
            accountRiskPerTrade: 0.10,     // 10% of account
            maxConcurrentPositions: 2,
            dailyLossLimit: 0.05,           // 5% daily loss limit
            cooldownPeriod: 15 * 60 * 1000  // 15 minutes
        };

        // State
        this.candles = {
            '5m': [],
            '15m': [],
            '1h': []
        };
        this.currentPosition = null;  // 'LONG', 'SHORT', or null
        this.entryPrice = null;
        this.positionSize = null;
        this.lastTradeTime = 0;
        this.dailyPnL = 0;
        this.lastTradeDate = new Date().toDateString();
        this.accountBalance = 0;
        this.highestPrice = null;  // For trailing stop (LONG)
        this.lowestPrice = null;   // For trailing stop (SHORT)
        this.isTrailingActive = false;

        // WebSocket connections
        this.websockets = {};
    }

    async start() {
        console.log(`\n🚀 SOLUSDT Multi-Timeframe Trend Strategy Builder Started`);
        console.log(`   Pair       : ${this.pair}`);
        console.log(`   Leverage   : ${this.leverage}x`);
        console.log(`   Timeframes : ${this.timeframes.entry} (entry), ${this.timeframes.intermediate} (intermediate), ${this.timeframes.major} (major)`);
        console.log(`   Network    : ${this.client.testnet ? 'TESTNET' : 'LIVE'}\n`);

        try {
            // 1. Get account balance and set leverage
            await this.initializeAccount();

            // 2. Load historical data for all timeframes
            await this.loadInitialHistory();

            // 3. Subscribe to WebSocket streams for all timeframes
            await this.subscribeToStreams();

            // 4. Start monitoring loop
            this.startMonitoring();

        } catch (err) {
            console.error('❌ Fatal Error during start:', err.message);
            process.exit(1);
        }
    }

    async initializeAccount() {
        console.log('💰 Initializing account...');
        
        // Get account balance
        const balance = await this.client.getBalance();
        const usdtBalance = balance.find(b => b.asset === 'USDT');
        this.accountBalance = parseFloat(usdtBalance.availableBalance);
        console.log(`   Account Balance: ${this.accountBalance.toFixed(2)} USDT`);

        // Set leverage
        await this.client.changeInitialLeverage({
            symbol: this.pair,
            leverage: this.leverage
        });
        console.log(`   ✅ Leverage set to ${this.leverage}x`);
    }

    async loadInitialHistory() {
        console.log('\n📥 Loading historical candle data...');

        const timeframes = Object.values(this.timeframes);
        
        for (const tf of timeframes) {
            try {
                const limit = tf === this.timeframes.major ? 100 : 50;
                const raw = await this.client.getKlines(this.pair, tf, { limit });
                
                this.candles[tf] = raw.map(k => ({
                    timestamp: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));

                console.log(`   ✅ ${tf}: ${this.candles[tf].length} candles loaded`);
            } catch (err) {
                console.error(`   ❌ Failed to load ${tf} candles:`, err.message);
                throw err;
            }
        }
    }

    async subscribeToStreams() {
        console.log('\n📡 Subscribing to WebSocket streams...');

        // Subscribe to entry timeframe (5m) for trading signals
        this.client.wsSubscribeCandles(this.pair, this.timeframes.entry);
        
        // Also subscribe to intermediate timeframe for trend confirmation
        this.client.wsSubscribeCandles(this.pair, this.timeframes.intermediate);

        // Handle candle events
        this.client.on('ws:candlestick', (candle) => {
            this.onCandleUpdate(candle);
        });

        console.log(`   ✅ Subscribed to ${this.timeframes.entry} and ${this.timeframes.intermediate} streams`);
    }

    onCandleUpdate(candle) {
        const timeframe = candle.interval;
        
        // Only process closed candles for signal generation
        if (candle.raw.k.x) {
            // Update candle history
            this.updateCandles(timeframe, candle);

            // Only evaluate signals on entry timeframe
            if (timeframe === this.timeframes.entry) {
                this.evaluateTradingSignal();
            }

            // Check exit conditions if in position
            if (this.currentPosition) {
                this.checkExitConditions(candle.close);
            }
        } else {
            // Update current price for real-time monitoring
            if (this.currentPosition) {
                this.checkExitConditions(candle.close);
            }
        }
    }

    updateCandles(timeframe, candle) {
        const candleData = {
            timestamp: candle.closeTime,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        };

        this.candles[timeframe].push(candleData);

        // Keep reasonable window sizes
        const maxLen = timeframe === this.timeframes.major ? 100 : 50;
        if (this.candles[timeframe].length > maxLen) {
            this.candles[timeframe].shift();
        }
    }

    calculateIndicators(timeframe) {
        const candles = this.candles[timeframe];
        if (candles.length < this.indicatorParams.emaSlow + 10) {
            return null;
        }

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // EMAs
        const emaFast = EMA.calculate({ values: closes, period: this.indicatorParams.emaFast });
        const emaSlow = EMA.calculate({ values: closes, period: this.indicatorParams.emaSlow });
        const emaMajor = EMA.calculate({ values: closes, period: this.indicatorParams.emaMajor });

        // RSI
        const rsi = RSI.calculate({ values: closes, period: this.indicatorParams.rsiPeriod });

        // MACD
        const macd = MACD.calculate({
            values: closes,
            fastPeriod: this.indicatorParams.macdFast,
            slowPeriod: this.indicatorParams.macdSlow,
            signalPeriod: this.indicatorParams.macdSignal
        });

        // ADX
        const adx = ADX.calculate({
            high: highs,
            low: lows,
            close: closes,
            period: this.indicatorParams.adxPeriod
        });

        // ATR
        const atr = ATR.calculate({
            high: highs,
            low: lows,
            close: closes,
            period: this.indicatorParams.atrPeriod
        });

        const current = {
            emaFast: emaFast[emaFast.length - 1],
            emaSlow: emaSlow[emaSlow.length - 1],
            emaMajor: emaMajor && emaMajor[emaMajor.length - 1],
            rsi: rsi[rsi.length - 1],
            macd: macd[macd.length - 1],
            adx: adx[adx.length - 1],
            atr: atr[atr.length - 1],
            prevEmaFast: emaFast[emaFast.length - 2],
            prevEmaSlow: emaSlow[emaSlow.length - 2],
            prevMacdHistogram: macd[macd.length - 2]?.histogram
        };

        return current;
    }

    evaluateTradingSignal() {
        // Reset daily PnL if new day
        const today = new Date().toDateString();
        if (today !== this.lastTradeDate) {
            this.dailyPnL = 0;
            this.lastTradeDate = today;
        }

        // Check if already in position
        if (this.currentPosition) {
            return;
        }

        // Check cooldown period
        const now = Date.now();
        if (now - this.lastTradeTime < this.riskParams.cooldownPeriod) {
            const remaining = Math.ceil((this.riskParams.cooldownPeriod - (now - this.lastTradeTime)) / 1000);
            if (remaining % 60 === 0) {  // Log every minute
                console.log(`   ⏳ Cooldown: ${remaining}s remaining`);
            }
            return;
        }

        // Check daily loss limit
        if (this.dailyPnL <= -this.riskParams.dailyLossLimit * this.accountBalance) {
            console.log(`   🛑 Daily loss limit reached. Stopping trades.`);
            return;
        }

        // Get indicators for all timeframes
        const entryIndicators = this.calculateIndicators(this.timeframes.entry);
        const intermediateIndicators = this.calculateIndicators(this.timeframes.intermediate);
        const majorIndicators = this.calculateIndicators(this.timeframes.major);

        if (!entryIndicators || !intermediateIndicators || !majorIndicators) {
            console.log('   ⏳ Waiting for more data...');
            return;
        }

        const currentPrice = this.candles[this.timeframes.entry][this.candles[this.timeframes.entry].length - 1].close;

        // Evaluate LONG signal
        const longSignal = this.evaluateLongSignal(entryIndicators, intermediateIndicators, majorIndicators, currentPrice);
        
        // Evaluate SHORT signal
        const shortSignal = this.evaluateShortSignal(entryIndicators, intermediateIndicators, majorIndicators, currentPrice);

        if (longSignal) {
            console.log('\n📈 LONG SIGNAL DETECTED!');
            this.printSignalDetails('LONG', entryIndicators, intermediateIndicators, majorIndicators);
            this.executeEntry('BUY', currentPrice);
        } else if (shortSignal) {
            console.log('\n📉 SHORT SIGNAL DETECTED!');
            this.printSignalDetails('SHORT', entryIndicators, intermediateIndicators, majorIndicators);
            this.executeEntry('SELL', currentPrice);
        }
    }

    evaluateLongSignal(entry, intermediate, major, currentPrice) {
        // Major timeframe (1h): Price above EMA(50) AND ADX > 25
        const majorTrendBullish = currentPrice > major.emaMajor && major.adx > 25;

        // Intermediate timeframe (15m): EMA(9) > EMA(21) AND RSI > 50
        const intermediateBullish = intermediate.emaFast > intermediate.emaSlow && intermediate.rsi > 50;

        // Entry timeframe (5m): EMA(9) crosses above EMA(21)
        const emaCrossBullish = entry.prevEmaFast <= entry.prevEmaSlow && entry.emaFast > entry.emaSlow;

        // MACD confirmation: histogram turns positive
        const macdBullish = entry.macd.histogram > 0 && (!entry.prevMacdHistogram || entry.prevMacdHistogram <= 0);

        // ADX confirms strong trend
        const adxStrong = entry.adx > 25;

        return majorTrendBullish && intermediateBullish && emaCrossBullish && macdBullish && adxStrong;
    }

    evaluateShortSignal(entry, intermediate, major, currentPrice) {
        // Major timeframe (1h): Price below EMA(50) AND ADX > 25
        const majorTrendBearish = currentPrice < major.emaMajor && major.adx > 25;

        // Intermediate timeframe (15m): EMA(9) < EMA(21) AND RSI < 50
        const intermediateBearish = intermediate.emaFast < intermediate.emaSlow && intermediate.rsi < 50;

        // Entry timeframe (5m): EMA(9) crosses below EMA(21)
        const emaCrossBearish = entry.prevEmaFast >= entry.prevEmaSlow && entry.emaFast < entry.emaSlow;

        // MACD confirmation: histogram turns negative
        const macdBearish = entry.macd.histogram < 0 && (!entry.prevMacdHistogram || entry.prevMacdHistogram >= 0);

        // ADX confirms strong trend
        const adxStrong = entry.adx > 25;

        return majorTrendBearish && intermediateBearish && emaCrossBearish && macdBearish && adxStrong;
    }

    printSignalDetails(direction, entry, intermediate, major) {
        console.log(`   Major (1h):    Price ${direction === 'LONG' ? '>' : '<'} EMA(50)=${major.emaMajor.toFixed(2)}, ADX=${major.adx.toFixed(2)}`);
        console.log(`   Inter (15m):   EMA(${this.indicatorParams.emaFast}) ${direction === 'LONG' ? '>' : '<'} EMA(${this.indicatorParams.emaSlow}), RSI=${intermediate.rsi.toFixed(2)}`);
        console.log(`   Entry (5m):    EMA Cross ${direction === 'LONG' ? '↑' : '↓'}, MACD=${entry.macd.histogram.toFixed(4)}, ADX=${entry.adx.toFixed(2)}`);
    }

    async executeEntry(side, currentPrice) {
        try {
            // Calculate position size based on account balance and leverage
            const positionValue = this.accountBalance * this.riskParams.accountRiskPerTrade * this.leverage;
            this.positionSize = positionValue / currentPrice;

            console.log(`\n📝 Executing ${side} order...`);
            console.log(`   Position Size: ${this.positionSize.toFixed(4)} ${this.pair.replace('USDT', '')}`);
            console.log(`   Position Value: ${(positionValue).toFixed(2)} USDT (${this.leverage}x leverage)`);

            // Place market order
            const order = await this.client.createOrder({
                pair: this.pair,
                side: side,
                type: 'MARKET',
                quantity: this.positionSize
            });

            this.currentPosition = side === 'BUY' ? 'LONG' : 'SHORT';
            this.entryPrice = parseFloat(order.avgPrice || order.price);

            // Fetch entry price if not in response
            if (!this.entryPrice || this.entryPrice === 0) {
                const risk = await this.client.getPositionRisk(this.pair);
                const pos = risk.find(p => p.symbol === this.client.normalizeSymbol(this.pair));
                this.entryPrice = parseFloat(pos.entryPrice);
            }

            // Initialize trailing stop tracking
            this.highestPrice = this.currentPosition === 'LONG' ? this.entryPrice : null;
            this.lowestPrice = this.currentPosition === 'SHORT' ? this.entryPrice : null;
            this.isTrailingActive = false;

            this.lastTradeTime = Date.now();

            console.log(`✅ ${this.currentPosition} position opened @ ${this.entryPrice.toFixed(4)}`);
            console.log(`   Target Profit: ${((1 + this.riskParams.takeProfit) * this.entryPrice).toFixed(4)}`);
            console.log(`   Stop Loss: ${((1 - this.riskParams.stopLoss) * this.entryPrice).toFixed(4)}`);

        } catch (err) {
            console.error('❌ Failed to execute entry:', err.message);
        }
    }

    checkExitConditions(currentPrice) {
        if (!this.currentPosition || !this.entryPrice) return;

        // Update highest/lowest prices for trailing stop
        if (this.currentPosition === 'LONG') {
            if (currentPrice > this.highestPrice) {
                this.highestPrice = currentPrice;
            }
            
            // Check if trailing stop should activate
            const profitPercent = (currentPrice - this.entryPrice) / this.entryPrice;
            if (profitPercent >= this.riskParams.trailingStopActivation && !this.isTrailingActive) {
                this.isTrailingActive = true;
                console.log(`\n🔓 Trailing stop activated for LONG position`);
            }
        } else {
            if (currentPrice < this.lowestPrice) {
                this.lowestPrice = currentPrice;
            }

            // Check if trailing stop should activate
            const profitPercent = (this.entryPrice - currentPrice) / this.entryPrice;
            if (profitPercent >= this.riskParams.trailingStopActivation && !this.isTrailingActive) {
                this.isTrailingActive = true;
                console.log(`\n🔓 Trailing stop activated for SHORT position`);
            }
        }

        // Calculate current PnL
        let pnlPercent;
        if (this.currentPosition === 'LONG') {
            pnlPercent = (currentPrice - this.entryPrice) / this.entryPrice;
        } else {
            pnlPercent = (this.entryPrice - currentPrice) / this.entryPrice;
        }

        // Check take profit
        if (pnlPercent >= this.riskParams.takeProfit) {
            console.log(`\n🏆 TAKE PROFIT triggered! PnL: +${(pnlPercent * 100).toFixed(2)}%`);
            this.executeExit('TAKE PROFIT', currentPrice);
            return;
        }

        // Check stop loss
        if (pnlPercent <= -this.riskParams.stopLoss) {
            console.log(`\n🛑 STOP LOSS triggered! PnL: ${(pnlPercent * 100).toFixed(2)}%`);
            this.executeExit('STOP LOSS', currentPrice);
            return;
        }

        // Check trailing stop
        if (this.isTrailingActive) {
            let trailingStopPrice;
            if (this.currentPosition === 'LONG') {
                trailingStopPrice = this.highestPrice * (1 - this.riskParams.trailingStopDistance);
                if (currentPrice <= trailingStopPrice) {
                    console.log(`\n🔒 TRAILING STOP triggered! PnL: ${(pnlPercent * 100).toFixed(2)}%`);
                    this.executeExit('TRAILING STOP', currentPrice);
                    return;
                }
            } else {
                trailingStopPrice = this.lowestPrice * (1 + this.riskParams.trailingStopDistance);
                if (currentPrice >= trailingStopPrice) {
                    console.log(`\n🔒 TRAILING STOP triggered! PnL: ${(pnlPercent * 100).toFixed(2)}%`);
                    this.executeExit('TRAILING STOP', currentPrice);
                    return;
                }
            }
        }

        // Check trend weakness (ADX drops below 20)
        const entryIndicators = this.calculateIndicators(this.timeframes.entry);
        if (entryIndicators && entryIndicators.adx < 20 && pnlPercent > 0) {
            console.log(`\n⚠️  Trend weakening (ADX < 20). Exiting position.`);
            this.executeExit('TREND WEAKENING', currentPrice);
            return;
        }
    }

    async executeExit(reason, currentPrice) {
        try {
            const closeSide = this.currentPosition === 'LONG' ? 'SELL' : 'BUY';

            console.log(`\n📝 Closing ${this.currentPosition} position (${reason})...`);

            const order = await this.client.createOrder({
                pair: this.pair,
                side: closeSide,
                type: 'MARKET',
                quantity: this.positionSize,
                reduceOnly: true
            });

            // Calculate actual PnL
            let pnlPercent;
            if (this.currentPosition === 'LONG') {
                pnlPercent = (currentPrice - this.entryPrice) / this.entryPrice;
            } else {
                pnlPercent = (this.entryPrice - currentPrice) / this.entryPrice;
            }

            const pnlUSDT = pnlPercent * this.positionSize * this.entryPrice;
            this.dailyPnL += pnlUSDT;

            console.log(`🏁 Position closed @ ${currentPrice.toFixed(4)}`);
            console.log(`   PnL: ${pnlUSDT.toFixed(2)} USDT (${(pnlPercent * 100).toFixed(2)}%)`);
            console.log(`   Daily PnL: ${this.dailyPnL.toFixed(2)} USDT`);

            // Reset position state
            this.currentPosition = null;
            this.entryPrice = null;
            this.positionSize = null;
            this.highestPrice = null;
            this.lowestPrice = null;
            this.isTrailingActive = false;

        } catch (err) {
            console.error('❌ Failed to execute exit:', err.message);
        }
    }

    startMonitoring() {
        // Periodic account balance update
        setInterval(async () => {
            try {
                const balance = await this.client.getBalance();
                const usdtBalance = balance.find(b => b.asset === 'USDT');
                this.accountBalance = parseFloat(usdtBalance.availableBalance);
            } catch (err) {
                console.error('Error updating balance:', err.message);
            }
        }, 60000);  // Every minute

        // Print status report every 5 minutes
        setInterval(() => {
            this.printStatusReport();
        }, 300000);
    }

    printStatusReport() {
        const entryIndicators = this.calculateIndicators(this.timeframes.entry);
        
        console.log('\n========== STRATEGY STATUS REPORT ==========');
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        console.log(`Pair: ${this.pair} | Leverage: ${this.leverage}x`);
        console.log(`Account Balance: ${this.accountBalance.toFixed(2)} USDT`);
        console.log(`Daily PnL: ${this.dailyPnL.toFixed(2)} USDT`);
        
        if (this.currentPosition) {
            let currentPnl;
            const currentPrice = this.candles[this.timeframes.entry][this.candles[this.timeframes.entry].length - 1].close;
            if (this.currentPosition === 'LONG') {
                currentPnl = (currentPrice - this.entryPrice) / this.entryPrice;
            } else {
                currentPnl = (this.entryPrice - currentPrice) / this.entryPrice;
            }
            console.log(`Active Position: ${this.currentPosition} @ ${this.entryPrice.toFixed(4)}`);
            console.log(`Current PnL: ${(currentPnl * 100).toFixed(2)}%`);
            if (this.isTrailingActive) {
                console.log(`Trailing Stop: ACTIVE`);
            }
        } else {
            console.log(`Active Position: NONE`);
        }

        if (entryIndicators) {
            console.log('\nCurrent Indicators (5m):');
            console.log(`  EMA(${this.indicatorParams.emaFast}): ${entryIndicators.emaFast.toFixed(4)}`);
            console.log(`  EMA(${this.indicatorParams.emaSlow}): ${entryIndicators.emaSlow.toFixed(4)}`);
            console.log(`  RSI: ${entryIndicators.rsi.toFixed(2)}`);
            console.log(`  MACD Histogram: ${entryIndicators.macd.histogram.toFixed(6)}`);
            console.log(`  ADX: ${entryIndicators.adx.toFixed(2)}`);
            console.log(`  ATR: ${entryIndicators.atr.toFixed(4)}`);
        }

        console.log('=============================================\n');
    }

    async stop() {
        console.log('\n🛑 Stopping strategy...');
        
        // Close any open position
        if (this.currentPosition) {
            console.log('Closing active position before shutdown...');
            const currentPrice = this.candles[this.timeframes.entry][this.candles[this.timeframes.entry].length - 1].close;
            await this.executeExit('MANUAL SHUTDOWN', currentPrice);
        }

        // Close WebSocket connections
        this.client.closeAllWebSockets();
        
        console.log('Strategy stopped.');
    }
}

// =====================================================================
// CONFIGURATION
// =====================================================================
const strategy = new SOLUSDTTrendStrategyBuilder({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,  // ALWAYS use testnet first!
    pair: 'SOLUSDT',
    leverage: 10
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT. Shutting down gracefully...');
    await strategy.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM. Shutting down gracefully...');
    await strategy.stop();
    process.exit(0);
});

// Start the strategy
strategy.start();
