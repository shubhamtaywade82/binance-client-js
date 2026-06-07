const { BinanceFuturesClient } = require('../binance-futures-client');
const { ATR } = require('technicalindicators');
require('dotenv').config();

/**
 * --- Supertrend Trading Bot ---
 * Strategy:
 * 1. Timeframe: 5m
 * 2. Indicator: Supertrend (10, 3)
 * 3. Entry: When Supertrend flips (Up for Buy, Down for Sell)
 * 4. Exit: 0.5% PnL (Fixed Take Profit and Stop Loss)
 */

class SupertrendBot {
    constructor(config) {
        this.client = new BinanceFuturesClient({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            testnet: config.testnet,
            debug: false
        });

        this.pair = config.pair || 'BTCUSDT';
        this.timeframe = '5m';
        this.multiplier = 3;
        this.period = 10;
        this.targetPnl = 0.005; // 0.5%
        this.quantity = config.quantity || 0.005; // BTC quantity
        
        this.candles = [];
        this.currentPosition = null; // 'LONG', 'SHORT', or null
        this.lastTrend = null; // 1 for UP, -1 for DOWN
    }

    async start() {
        console.log(`🚀 Starting Supertrend Bot on ${this.pair} (${this.timeframe})...`);
        
        try {
            // 1. Initial Sync
            await this.syncPosition();
            await this.loadInitialHistory();

            // 2. Subscribe to 5m Candles
            console.log('📡 Subscribing to live candle stream...');
            this.client.wsSubscribeCandles(this.pair, this.timeframe);

            this.client.on('ws:candlestick', (candle) => {
                // We only care about the close of the candle to confirm indicator
                if (candle.raw.k.x) {
                    console.log(`\n⏰ Candle Closed at ${new Date(candle.closeTime).toLocaleTimeString()}: ${candle.close}`);
                    this.updateCandles(candle);
                    this.processSignal();
                } else {
                    // Update current price for real-time PnL if needed
                    this.checkActivePositionExit(candle.close);
                }
            });

        } catch (err) {
            console.error('Fatal Error during start:', err.message);
        }
    }

    async syncPosition() {
        const risk = await this.client.getPositionRisk(this.pair);
        const pos = risk.find(p => p.symbol === this.client.normalizeSymbol(this.pair));
        const amt = parseFloat(pos.positionAmt);
        
        if (amt > 0) this.currentPosition = 'LONG';
        else if (amt < 0) this.currentPosition = 'SHORT';
        else this.currentPosition = null;

        console.log(`[SYNC] Current Position: ${this.currentPosition || 'NONE'} (${amt})`);
    }

    async loadInitialHistory() {
        console.log('📥 Loading historical candles for ATR...');
        const raw = await this.client.getKlines(this.pair, this.timeframe, { limit: 100 });
        this.candles = raw.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
        }));
        
        // Calculate initial trend
        const { trend } = this.calculateSupertrend(this.candles);
        this.lastTrend = trend[trend.length - 1];
        console.log(`[OK] History Loaded. Initial Trend: ${this.lastTrend === 1 ? 'UP' : 'DOWN'}`);
    }

    updateCandles(candle) {
        this.candles.push({
            high: candle.high,
            low: candle.low,
            close: candle.close
        });
        if (this.candles.length > 100) this.candles.shift();
    }

    calculateSupertrend(data) {
        const input = {
            high: data.map(d => d.high),
            low: data.map(d => d.low),
            close: data.map(d => d.close),
            period: this.period
        };

        const atrValues = ATR.calculate(input);
        const trend = [];
        const upperBand = [];
        const lowerBand = [];

        // Simple Supertrend Implementation
        for (let i = 0; i < data.length; i++) {
            if (i < this.period) {
                trend.push(null);
                upperBand.push(null);
                lowerBand.push(null);
                continue;
            }

            const median = (data[i].high + data[i].low) / 2;
            const atr = atrValues[i - this.period];

            let ub = median + (this.multiplier * atr);
            let lb = median - (this.multiplier * atr);

            // Band tightening
            if (lowerBand[i - 1]) lb = lb > lowerBand[i - 1] || data[i - 1].close < lowerBand[i - 1] ? lb : lowerBand[i - 1];
            if (upperBand[i - 1]) ub = ub < upperBand[i - 1] || data[i - 1].close > upperBand[i - 1] ? ub : upperBand[i - 1];

            lowerBand.push(lb);
            upperBand.push(ub);

            let t;
            if (!trend[i - 1]) {
                t = 1;
            } else if (trend[i - 1] === 1) {
                t = data[i].close < lowerBand[i] ? -1 : 1;
            } else {
                t = data[i].close > upperBand[i] ? 1 : -1;
            }
            trend.push(t);
        }

        return { trend, upperBand, lowerBand };
    }

    async processSignal() {
        const { trend } = this.calculateSupertrend(this.candles);
        const currentTrend = trend[trend.length - 1];

        if (currentTrend === 1 && this.lastTrend === -1) {
            console.log('📈 Supertrend turned UP! [SIGNAL: BUY]');
            await this.openPosition('BUY');
        } else if (currentTrend === -1 && this.lastTrend === 1) {
            console.log('📉 Supertrend turned DOWN! [SIGNAL: SELL]');
            await this.openPosition('SELL');
        }

        this.lastTrend = currentTrend;
    }

    async openPosition(side) {
        if (this.currentPosition) {
            console.log('⚠️ Already in a position. Closing existing first...');
            await this.client.cancelAllOpenOrders(this.pair);
            await this.client.createOrder({
                pair: this.pair,
                side: this.currentPosition === 'LONG' ? 'SELL' : 'BUY',
                type: 'MARKET',
                quantity: this.quantity,
                reduceOnly: true
            });
        }

        console.log(`📝 Opening ${side} position for ${this.quantity}...`);
        const order = await this.client.createOrder({
            pair: this.pair,
            side: side,
            type: 'MARKET',
            quantity: this.quantity
        });

        this.currentPosition = side === 'BUY' ? 'LONG' : 'SHORT';
        this.entryPrice = parseFloat(order.avgPrice || order.price); // Note: Market order response might vary
        
        // Because Market order might not return avgPrice immediately on some endpoints, we fetch it
        if (!this.entryPrice || this.entryPrice === 0) {
            const risk = await this.client.getPositionRisk(this.pair);
            const pos = risk.find(p => p.symbol === this.client.normalizeSymbol(this.pair));
            this.entryPrice = parseFloat(pos.entryPrice);
        }

        console.log(`✅ ${this.currentPosition} Opened at ${this.entryPrice}`);
    }

    async checkActivePositionExit(currentPrice) {
        if (!this.currentPosition || !this.entryPrice) return;

        const pnl = this.currentPosition === 'LONG' 
            ? (currentPrice - this.entryPrice) / this.entryPrice
            : (this.entryPrice - currentPrice) / this.entryPrice;

        // Check if 0.5% target reached (either profit or loss)
        if (Math.abs(pnl) >= this.targetPnl) {
            const result = pnl >= 0 ? '🏆 TAKE PROFIT' : '🛑 STOP LOSS';
            console.log(`${result} triggered! PnL: ${(pnl * 100).toFixed(2)}% at Price: ${currentPrice}`);
            
            try {
                await this.client.createOrder({
                    pair: this.pair,
                    side: this.currentPosition === 'LONG' ? 'SELL' : 'BUY',
                    type: 'MARKET',
                    quantity: this.quantity,
                    reduceOnly: true
                });
                this.currentPosition = null;
                this.entryPrice = null;
                console.log('🏁 Position closed.');
            } catch (err) {
                console.error('Failed to close position:', err.message);
            }
        }
    }
}

// Configuration
const bot = new SupertrendBot({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,
    pair: 'BTCUSDT',
    quantity: 0.01 // Minimum allowed on testnet for BTC is usually 0.001 or 0.01
});

bot.start();
