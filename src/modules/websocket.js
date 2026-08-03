const { BinanceBase } = require('../base');

/**
 * WebSocket Module - Public and Private WebSocket streams
 * Market data streams are public (no auth required)
 * User data streams require API credentials
 */
class WebSocketStreams extends BinanceBase {
    /**
     * Subscribe to candlestick/kline stream
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval (1m, 5m, 1h, etc.)
     * @returns {WebSocket} WebSocket connection
     */
    subscribeCandles(pair, interval = '1m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@kline_${interval}`, pair, 'candlestick');
    }

    /**
     * Subscribe to order book depth stream
     * @param {string} pair - Trading pair
     * @param {number} depth - Depth level (5, 10, 20)
     * @returns {WebSocket} WebSocket connection
     */
    subscribeOrderBook(pair, depth = 20) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@depth${depth}`, pair, 'depth');
    }

    /**
     * Subscribe to trade stream
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribeTrades(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@aggTrade`, pair, 'trade');
    }

    /**
     * Subscribe to all market tickers
     * @returns {WebSocket} WebSocket connection
     */
    subscribeAllMarketTickers() {
        return this.subscribeMarketStream('!ticker@arr', null, 'allMarketTickers');
    }

    /**
     * Subscribe to all book tickers
     * @returns {WebSocket} WebSocket connection
     */
    subscribeAllBookTickers() {
        return this.subscribeMarketStream('!bookTicker', null, 'allBookTickers');
    }

    /**
     * Subscribe to all liquidation order stream
     * @returns {WebSocket} WebSocket connection
     */
    subscribeAllLiquidationOrders() {
        return this.subscribeMarketStream('!forceOrder@arr', null, 'allLiquidationOrders');
    }

    /**
     * Subscribe to liquidation order stream for a symbol
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribeLiquidationOrder(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@forceOrder`, pair, 'liquidationOrder');
    }

    /**
     * Subscribe to composite index stream
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribeCompositeIndex(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}_compositeIndex@markPrice`, pair, 'compositeIndex');
    }

    /**
     * Subscribe to mark price stream for all symbols
     * @returns {WebSocket} WebSocket connection
     */
    subscribeAllMarkPrices() {
        return this.subscribeMarketStream('!markPrice@arr', null, 'allMarkPrices');
    }

    /**
     * Subscribe to mark price stream for a symbol
     * @param {string} pair - Trading pair
     * @param {number} [speed=1] - Speed (1 for 1-second, 3 for 3-second)
     * @returns {WebSocket} WebSocket connection
     */
    subscribeMarkPrice(pair, speed = 1) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        const suffix = speed === 1 ? '@markPrice' : '@markPrice@1s';
        return this.subscribeMarketStream(`${symbol}${suffix}`, pair, 'markPrice');
    }

    /**
     * Subscribe to premium index stream
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribePremiumIndex(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@premiumIndex`, pair, 'premiumIndex');
    }

    /**
     * Subscribe to continuous contract kline stream
     * @param {string} pair - Trading pair
     * @param {string} contractType - Contract type
     * @param {string} interval - Kline interval
     * @returns {WebSocket} WebSocket connection
     */
    subscribeContinuousKlines(pair, contractType, interval) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(
            `${symbol}_${contractType.toLowerCase()}@continuousKline_${interval}`,
            pair,
            'continuousKline'
        );
    }

    /**
     * Subscribe to index price kline stream
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval
     * @returns {WebSocket} WebSocket connection
     */
    subscribeIndexPriceKlines(pair, interval) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(
            `${symbol}_indexPriceKline_${interval}`,
            pair,
            'indexPriceKline'
        );
    }

    /**
     * Subscribe to mark price kline stream
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval
     * @returns {WebSocket} WebSocket connection
     */
    subscribeMarkPriceKlines(pair, interval) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(
            `${symbol}_markPriceKline_${interval}`,
            pair,
            'markPriceKline'
        );
    }

    /**
     * Subscribe to mini ticker stream for all symbols
     * @returns {WebSocket} WebSocket connection
     */
    subscribeAllMiniTickers() {
        return this.subscribeMarketStream('!miniTicker@arr', null, 'allMiniTickers');
    }

    /**
     * Subscribe to mini ticker stream for a symbol
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribeMiniTicker(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@miniTicker`, pair, 'miniTicker');
    }

    /**
     * Subscribe to book ticker stream for a symbol
     * @param {string} pair - Trading pair
     * @returns {WebSocket} WebSocket connection
     */
    subscribeBookTicker(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@bookTicker`, pair, 'bookTicker');
    }

    /**
     * Subscribe to open interest stream for a symbol
     * @param {string} pair - Trading pair
     * @param {number} [period=5m] - Period
     * @returns {WebSocket} WebSocket connection
     */
    subscribeOpenInterest(pair, period = '5m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@openInterest_${period}`, pair, 'openInterest');
    }

    /**
     * Subscribe to user data stream (requires authentication)
     * @returns {Promise<WebSocket>} WebSocket connection
     */
    async subscribeUserData() {
        this.requireAuth();
        
        // Get listen key
        const response = await this._request('POST', '/fapi/v1/listenKey', {}, false);
        this.listenKey = response.listenKey;
        
        const wsUrl = `${this.wsUserBase}/${this.listenKey}`;
        this._log(`Subscribing to user data stream: ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        this.wsConnections.add(ws);

        ws.on('open', () => {
            this._log('User data stream connected');
            this.emit('connected', { type: 'userData' });
        });

        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                
                // Emit specific events based on payload
                if (parsed.e === 'ORDER_TRADE_UPDATE') {
                    this.emit(this.wsEvents.accountOrder, parsed);
                } else if (parsed.e === 'ACCOUNT_UPDATE') {
                    if (parsed.a.P) {
                        this.emit(this.wsEvents.accountPosition, parsed);
                    }
                    if (parsed.a.B) {
                        this.emit(this.wsEvents.accountBalance, parsed);
                    }
                }
                
                this.emit('userData', parsed);
            } catch (err) {
                this.emit('error', { message: 'Parse error', error: err, type: 'userData' });
            }
        });

        ws.on('error', (err) => {
            this._log('User data stream error:', err.message);
            this.emit('error', { message: err.message, type: 'userData' });
        });

        ws.on('close', () => {
            this._log('User data stream closed');
            this.wsConnections.delete(ws);
            this.emit('disconnected', { type: 'userData' });
        });

        // Keep-alive for listen key (every 30 minutes)
        if (this.listenKeyInterval) {
            clearInterval(this.listenKeyInterval);
        }
        this.listenKeyInterval = setInterval(async () => {
            try {
                await this._request('PUT', '/fapi/v1/listenKey', {}, false);
                this._log('Listen key keep-alive sent');
            } catch (err) {
                this._log('Listen key keep-alive failed:', err.message);
            }
        }, 30 * 60 * 1000);

        return ws;
    }

    /**
     * Subscribe to multiple streams at once
     * @param {Array<string>} streams - Array of stream names
     * @returns {WebSocket} WebSocket connection
     */
    subscribeCombined(streams) {
        const streamPath = streams.join('/');
        const wsUrl = `${this.wsBase}/stream?streams=${streamPath}`;
        this._log(`Subscribing to combined streams: ${streamPath}`);
        
        const ws = new WebSocket(wsUrl);
        this.wsConnections.add(ws);

        ws.on('open', () => {
            this._log('Combined stream connected');
            this.emit('connected', { streams, type: 'combined' });
        });

        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                this.emit('combinedData', parsed);
            } catch (err) {
                this.emit('error', { message: 'Parse error', error: err, type: 'combined' });
            }
        });

        ws.on('error', (err) => {
            this._log('Combined stream error:', err.message);
            this.emit('error', { message: err.message, type: 'combined' });
        });

        ws.on('close', () => {
            this._log('Combined stream closed');
            this.wsConnections.delete(ws);
            this.emit('disconnected', { type: 'combined' });
        });

        return ws;
    }
}

module.exports = { WebSocketStreams };
