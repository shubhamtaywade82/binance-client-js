const { BinanceFuturesClient } = require('../binance-futures-client');
const { EMA, RSI } = require('technicalindicators');
require('dotenv').config();

/**
 * --- Simple EMA Crossover Scalping Bot ---
 *
 * Strategy:
 * 1. Timeframe: 1m (fast, ideal for scalping)
 * 2. Indicators: Fast EMA(5) + Slow EMA(15) + RSI(14) filter
 * 3. Entry LONG : Fast EMA crosses above Slow EMA AND RSI > 55 (bullish momentum)
 * 4. Entry SHORT: Fast EMA crosses below Slow EMA AND RSI < 45 (bearish momentum)
 * 5. Exit       : Fixed Take-Profit (+0.3 %) or Stop-Loss (-0.2 %)
 *
 * Risk Management:
 * - Only 1 position at a time.
 * - 2-minute cooldown after each trade (prevents over-trading / whipsaws).
 * - Max 20 trades per day.
 * - Uses reduceOnly orders to close positions safely.
 */

class ScalpingBot {
    constructor(config) {
        this.client = new BinanceFuturesClient({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            testnet: config.testnet,
            debug: false
        });

        this.pair = config.pair || 'BTCUSDT';
        this.timeframe = config.timeframe || '1m';
        this.quantity = config.quantity || 0.001; // Adjust to testnet minimums

        /* --- Strategy params --- */
        this.fastPeriod = config.fastPeriod || 5;
        this.slowPeriod = config.slowPeriod || 15;
        this.rsiPeriod = config.rsiPeriod || 14;
        this.rsiLongThreshold = config.rsiLongThreshold || 55;
        this.rsiShortThreshold = config.rsiShortThreshold || 45;

        /* --- Risk params --- */
        this.takeProfit = config.takeProfit || 0.003; // 0.3 %
        this.stopLoss = config.stopLoss || 0.002;     // 0.2 %
        this.cooldownMs = (config.cooldownMinutes || 2) * 60 * 1000;
        this.maxDailyTrades = config.maxDailyTrades || 20;

        /* --- State --- */
        this.candles = [];          // OHLC history
        this.currentPosition = null; // 'LONG' | 'SHORT' | null
        this.entryPrice = null;
        this.lastTradeTime = 0;
        this.dailyTrades = 0;
        this.lastTradeDate = new Date().toDateString();

        /* --- WebSocket --- */
        this.ws = null;
        this.wsReconnectTimer = null;
        this.wsIntentionalClose = false;
    }

    /* ================================================================
       START
       ================================================================ */
    async start() {
        console.log(`\n🚀 Scalping Bot Started`);
        console.log(`   Pair      : ${this.pair}`);
        console.log(`   Timeframe : ${this.timeframe}`);
        console.log(`   Quantity  : ${this.quantity}`);
        console.log(`   Net       : ${this.client.testnet ? 'TESTNET' : 'LIVE'}\n`);

        try {
            // 1. Sync existing position (in case bot was restarted)
            await this.syncPosition();

            // 2. Pre-load candle history for indicator warm-up
            await this.loadInitialHistory();

            // 3. Wire up candle listener (single registration)
            this.client.on('ws:candlestick', (candle) => this._onCandle(candle));

            // 4. Connect WebSocket (with visibility + auto-reconnect)
            this.connectWebSocket();
        } catch (err) {
            console.error('Fatal Error during start:', err.message);
        }
    }

    /* ================================================================
       WEBSOCKET LIFECYCLE
       ================================================================ */
    connectWebSocket() {
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }

        console.log('📡 Connecting to WebSocket stream...');
        this.wsIntentionalClose = false;
        this.ws = this.client.wsSubscribeCandles(this.pair, this.timeframe);

        this.ws.on('open', () => {
            console.log('✅ WebSocket CONNECTED');
        });

        this.ws.on('error', (err) => {
            console.error('❌ WebSocket ERROR:', err.message || err);
        });

        this.ws.on('close', (code, reason) => {
            console.warn(`⚠️ WebSocket CLOSED (code=${code}, reason=${reason || 'none'})`);
            this.ws = null;

            if (!this.wsIntentionalClose) {
                console.log('🔌 Auto-reconnecting in 5 seconds...');
                this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
            }
        });

        this.ws.on('ping', () => {
            if (this.ws && this.ws.readyState === 1) this.ws.pong();
        });
    }

    disconnectWebSocket() {
        this.wsIntentionalClose = true;
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
    }

    _onCandle(candle) {
        try {
            if (candle.raw.k.x) {
                // Candle closed → update history + evaluate entry signals
                console.log(
                    `\n⏰ Candle Closed [${new Date(candle.closeTime).toLocaleTimeString()}] ` +
                    `O:${candle.open.toFixed(2)} H:${candle.high.toFixed(2)} ` +
                    `L:${candle.low.toFixed(2)} C:${candle.close.toFixed(2)}`
                );
                this.updateCandles(candle);
                this.evaluateEntrySignal();
            } else {
                // Candle still forming → monitor open position for TP/SL
                this.checkActivePositionExit(candle.close);
            }
        } catch (err) {
            console.error('❌ _onCandle error:', err.message);
        }
    }

    /* ================================================================
       POSITION SYNC
       ================================================================ */
    async syncPosition() {
        try {
            const risk = await this.client.getPositionRisk(this.pair);
            const pos = risk.find(p => p.symbol === this.client.normalizeSymbol(this.pair));
            const amt = parseFloat(pos.positionAmt);

            if (amt > 0) this.currentPosition = 'LONG';
            else if (amt < 0) this.currentPosition = 'SHORT';
            else this.currentPosition = null;

            if (this.currentPosition) {
                this.entryPrice = parseFloat(pos.entryPrice);
            }

            console.log(
                `[SYNC] Position: ${this.currentPosition || 'NONE'} | ` +
                `Amt: ${amt} | Entry: ${this.entryPrice || 'N/A'}`
            );
        } catch (err) {
            console.error('❌ syncPosition error:', err.message);
            throw err; // Let start() know init failed
        }
    }

    /* ================================================================
       CANDLE HISTORY
       ================================================================ */
    async loadInitialHistory() {
        try {
            console.log('📥 Loading historical candles for indicator warm-up...');
            const limit = Math.max(this.slowPeriod, this.rsiPeriod) + 50;
            const raw = await this.client.getKlines(this.pair, this.timeframe, { limit });

            if (!Array.isArray(raw) || raw.length === 0) {
                throw new Error('Empty candle history returned from API');
            }

            this.candles = raw.map(k => ({
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4])
            }));

            console.log(`[OK] ${this.candles.length} candles loaded.\n`);
        } catch (err) {
            console.error('❌ loadInitialHistory error:', err.message);
            throw err;
        }
    }

    updateCandles(candle) {
        this.candles.push({
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        });

        // Keep a reasonable rolling window
        const maxLen = Math.max(this.slowPeriod, this.rsiPeriod) + 200;
        if (this.candles.length > maxLen) this.candles.shift();
    }

    /* ================================================================
       INDICATORS
       ================================================================ */
    calculateIndicators() {
        try {
            const closes = this.candles.map(c => c.close);

            if (closes.length < Math.max(this.slowPeriod, this.rsiPeriod)) {
                return { fast: null, slow: null, rsi: null, prevFast: null, prevSlow: null };
            }

            const fastEMA = EMA.calculate({ values: closes, period: this.fastPeriod });
            const slowEMA = EMA.calculate({ values: closes, period: this.slowPeriod });
            const rsiValues = RSI.calculate({ values: closes, period: this.rsiPeriod });

            return {
                fast: fastEMA.length ? fastEMA[fastEMA.length - 1] : null,
                slow: slowEMA.length ? slowEMA[slowEMA.length - 1] : null,
                rsi: rsiValues.length ? rsiValues[rsiValues.length - 1] : null,
                prevFast: fastEMA.length > 1 ? fastEMA[fastEMA.length - 2] : null,
                prevSlow: slowEMA.length > 1 ? slowEMA[slowEMA.length - 2] : null
            };
        } catch (err) {
            console.error('❌ calculateIndicators error:', err.message);
            return { fast: null, slow: null, rsi: null, prevFast: null, prevSlow: null };
        }
    }

    /* ================================================================
       ENTRY LOGIC
       ================================================================ */
    evaluateEntrySignal() {
        // Reset daily trade counter if new day
        const today = new Date().toDateString();
        if (today !== this.lastTradeDate) {
            this.dailyTrades = 0;
            this.lastTradeDate = today;
        }

        // Already in a position → do not enter again
        if (this.currentPosition) {
            console.log(`   [SKIP] Already in ${this.currentPosition} position.`);
            return;
        }

        // Cooldown check
        const now = Date.now();
        if (now - this.lastTradeTime < this.cooldownMs) {
            const remain = Math.ceil((this.cooldownMs - (now - this.lastTradeTime)) / 1000);
            console.log(`   [SKIP] Cooldown active (${remain}s remaining).`);
            return;
        }

        // Daily limit check
        if (this.dailyTrades >= this.maxDailyTrades) {
            console.log(`   [SKIP] Daily trade limit (${this.maxDailyTrades}) reached.`);
            return;
        }

        const ind = this.calculateIndicators();
        if (ind.fast === null || ind.slow === null || ind.rsi === null) {
            console.log('   [WAIT] Indicators still warming up...');
            return;
        }

        console.log(
            `   Indicators → Fast EMA: ${ind.fast.toFixed(2)} | ` +
            `Slow EMA: ${ind.slow.toFixed(2)} | RSI: ${ind.rsi.toFixed(2)}`
        );

        // CROSSOVER DETECTION (previous candle state vs current candle state)
        const wasAbove = ind.prevFast !== null && ind.prevSlow !== null && ind.prevFast > ind.prevSlow;
        const isAbove = ind.fast > ind.slow;

        // LONG  : Fast crosses above Slow  + RSI > threshold (momentum filter)
        if (!wasAbove && isAbove && ind.rsi > this.rsiLongThreshold) {
            console.log('📈 EMA Bullish Crossover + RSI Momentum → [SIGNAL: BUY]');
            this.openPosition('BUY');
            return;
        }

        // SHORT : Fast crosses below Slow  + RSI < threshold (momentum filter)
        if (wasAbove && !isAbove && ind.rsi < this.rsiShortThreshold) {
            console.log('📉 EMA Bearish Crossover + RSI Momentum → [SIGNAL: SELL]');
            this.openPosition('SELL');
            return;
        }

        console.log('   [HOLD] No valid entry signal.');
    }

    /* ================================================================
       ORDER EXECUTION
       ================================================================ */
    async openPosition(side) {
        try {
            // Cancel any lingering open orders first
            await this.client.cancelAllOpenOrders(this.pair);

            console.log(`📝 Placing MARKET ${side} order for ${this.quantity}...`);
            const order = await this.client.createOrder({
                pair: this.pair,
                side: side,
                type: 'MARKET',
                quantity: this.quantity
            });

            this.currentPosition = side === 'BUY' ? 'LONG' : 'SHORT';
            this.entryPrice = parseFloat(order.avgPrice || order.price);

            // Fallback: fetch entry price from position risk if not in response
            if (!this.entryPrice || this.entryPrice === 0) {
                const risk = await this.client.getPositionRisk(this.pair);
                const pos = risk.find(p => p.symbol === this.client.normalizeSymbol(this.pair));
                this.entryPrice = parseFloat(pos.entryPrice);
            }

            this.lastTradeTime = Date.now();
            this.dailyTrades++;

            console.log(
                `✅ ${this.currentPosition} OPENED @ ${this.entryPrice.toFixed(2)} | ` +
                `Daily Trades: ${this.dailyTrades}/${this.maxDailyTrades}`
            );
        } catch (err) {
            console.error('❌ Failed to open position:', err.message);
        }
    }

    async closePosition(reason) {
        if (!this.currentPosition) return;

        const closeSide = this.currentPosition === 'LONG' ? 'SELL' : 'BUY';

        try {
            console.log(`📝 Closing ${this.currentPosition} position (${reason})...`);
            await this.client.createOrder({
                pair: this.pair,
                side: closeSide,
                type: 'MARKET',
                quantity: this.quantity,
                reduceOnly: true
            });

            console.log(`🏁 Position CLOSED. Reason: ${reason}`);
        } catch (err) {
            console.error('❌ Failed to close position:', err.message);
        } finally {
            this.currentPosition = null;
            this.entryPrice = null;
        }
    }

    /* ================================================================
       TP / SL MONITORING  (checked on every live tick)
       ================================================================ */
    checkActivePositionExit(currentPrice) {
        if (!this.currentPosition || !this.entryPrice) return;

        let pnl;
        if (this.currentPosition === 'LONG') {
            pnl = (currentPrice - this.entryPrice) / this.entryPrice;
        } else {
            pnl = (this.entryPrice - currentPrice) / this.entryPrice;
        }

        if (pnl >= this.takeProfit) {
            console.log(`\n🏆 TAKE PROFIT hit! PnL: +${(pnl * 100).toFixed(2)}% @ ${currentPrice.toFixed(2)}`);
            this.closePosition('TAKE PROFIT');
        } else if (pnl <= -this.stopLoss) {
            console.log(`\n🛑 STOP LOSS hit! PnL: ${(pnl * 100).toFixed(2)}% @ ${currentPrice.toFixed(2)}`);
            this.closePosition('STOP LOSS');
        }
    }
}

/* =====================================================================
   CONFIGURATION
   ===================================================================== */
const bot = new ScalpingBot({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,                     // ← Always use testnet first!
    pair: 'BTCUSDT',
    quantity: 0.001,                   // Adjust to testnet minimums
    timeframe: '1m',                   // 1-minute candles for scalping
    fastPeriod: 5,                     // Fast EMA
    slowPeriod: 15,                    // Slow EMA
    rsiPeriod: 14,
    rsiLongThreshold: 55,              // RSI must be > 55 for longs
    rsiShortThreshold: 45,             // RSI must be < 45 for shorts
    takeProfit: 0.003,                 // 0.3 %
    stopLoss: 0.002,                   // 0.2 %
    cooldownMinutes: 2,                // Wait 2 min between trades
    maxDailyTrades: 20                 // Safety cap
});

bot.start();
