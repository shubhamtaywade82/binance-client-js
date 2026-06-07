const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * --- CUSTOM ERRORS ---
 */
class BinanceError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class BinanceAPIError extends BinanceError {
    constructor(message, status, data, method, url) {
        super(message);
        this.status = status;
        this.data = data;
        this.method = method;
        this.url = url;
        this.isRetryable = [429, 500, 502, 503, 504].includes(status);
    }
}

class BinanceNetworkError extends BinanceError {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.isRetryable = true;
    }
}

/**
 * Binance USDⓈ-M Futures Client Library (REST + WebSocket)
 *
 * Provides a unified interface for Binance USDⓈ-M Futures APIs.
 * Architecture and naming conventions aligned with CoinDCXFuturesClient.
 *
 * @version 1.0.0
 * @extends EventEmitter
 */
class BinanceFuturesClient extends EventEmitter {
    /**
     * @param {Object} options - Configuration options.
     * @param {string} [options.apiKey=''] - Your Binance API Key.
     * @param {string} [options.apiSecret=''] - Your Binance API Secret.
     * @param {boolean} [options.testnet=false] - Use Testnet URLs.
     * @param {boolean} [options.debug=false] - Enable console logging for requests.
     * @param {number} [options.recvWindow=5000] - Request validity period in ms.
     */
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey || '';
        this.apiSecret = options.apiSecret || '';
        this.testnet = options.testnet || false;
        this.debug = options.debug || false;
        this.recvWindow = options.recvWindow || 5000;

        this.apiBase = this.testnet 
            ? 'https://testnet.binancefuture.com' 
            : 'https://fapi.binance.com';
        
        this.wsBase = this.testnet
            ? 'wss://fstream.binancefuture.com/ws'
            : 'wss://fstream.binance.com/ws';

        this.wsUserBase = this.testnet
            ? 'wss://fstream.binancefuture.com/ws'
            : 'wss://fstream.binance.com/ws';

        this.ws = null;
        this.listenKey = null;
        this.listenKeyInterval = null;

        this.wsEvents = {
            candles: 'candlestick',
            orderBookSnapshot: 'depth-snapshot',
            orderBookUpdate: 'depth-update',
            trades: 'new-trade',
            prices: 'price-change',
            currentPrices: 'currentPrices@futures#update',
            accountOrder: 'df-order-update',
            accountPosition: 'df-position-update',
            accountBalance: 'balance-update',
        };
    }

    // --- Static Utilities ---

    static nowSeconds() { return Math.floor(Date.now() / 1000); }
    static buildPair(base, target, ecode = 'B') { return `${ecode}-${base}_${target}`; }
    static parsePair(pair) {
        const match = pair.match(/^([A-Z])-([A-Z0-9]+)_([A-Z0-9]+)$/);
        if (match) return { ecode: match[1], base: match[2], target: match[3] };
        return null;
    }

    /**
     * Helper to calculate estimated liquidation price for Isolated Margin.
     */
    static calculateLiquidationPrice(entryPrice, leverage, side, mm = 0.005) {
        const dir = side.toLowerCase() === 'buy' || side.toLowerCase() === 'long' ? 1 : -1;
        if (dir === 1) {
            return entryPrice * (1 - (1 / leverage) + mm);
        } else {
            return entryPrice * (1 + (1 / leverage) - mm);
        }
    }

    // --- Private Helpers ---

    _log(...args) {
        if (this.debug) {
            console.log(`[Binance-Futures] ${new Date().toISOString()}`, ...args);
        }
    }

    /**
     * Normalizes a symbol string (e.g., 'B-BTC_USDT' -> 'BTCUSDT').
     * @param {string} pair 
     * @returns {string}
     */
    normalizeSymbol(pair) {
        if (!pair) return '';
        // Handles both CoinDCX style 'B-BTC_USDT' and Binance style 'BTCUSDT'
        return pair.replace(/^B-/, '').replace('_', '').toUpperCase();
    }

    /**
     * Internal: Generates HMAC-SHA256 signature for requests.
     */
    _generateSignature(queryString) {
        if (!this.apiSecret) throw new BinanceError('API secret missing');
        return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    }

    /**
     * Internal: Generic request handler with auto-signing.
     */
    async _request(method, path, data = {}, isPublic = false) {
        const url = `${this.apiBase}${path}`;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Binance-Node-Client/1.0.0'
        };

        if (this.apiKey) {
            headers['X-MBX-APIKEY'] = this.apiKey;
        }

        let queryString = '';
        if (!isPublic) {
            if (!this.apiKey || !this.apiSecret) throw new BinanceError('API Key/Secret required');
            data.timestamp = Date.now();
            data.recvWindow = this.recvWindow;
            
            queryString = Object.entries(data)
                .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                .join('&');
            
            const signature = this._generateSignature(queryString);
            queryString += `&signature=${signature}`;
        } else {
            queryString = Object.entries(data)
                .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                .join('&');
        }

        const fullUrl = queryString ? `${url}?${queryString}` : url;

        try {
            this._log(`${method} ${fullUrl}`);
            const response = await axios({
                method,
                url: fullUrl,
                headers,
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new BinanceAPIError(
                    error.response.data.msg || error.response.statusText,
                    error.response.status,
                    error.response.data,
                    method, url
                );
            }
            throw new BinanceNetworkError(error.message, error);
        }
    }

    // --- Public Market Data ---

    async getPing() { return this._request('GET', '/fapi/v1/ping', {}, true); }
    async getServerTime() { return this._request('GET', '/fapi/v1/time', {}, true); }
    async getExchangeInfo() { return this._request('GET', '/fapi/v1/exchangeInfo', {}, true); }

    async getOrderBook(pair, limit = 100) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/depth', { symbol, limit }, true);
    }

    async getKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/klines', params, true);
    }

    async getTickerPrice(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/price', params, true);
    }

    async getMarkPrice(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/premiumIndex', params, true);
    }

    async getFundingRateHistory(pair, limit = 100) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/fundingRate', { symbol, limit }, true);
    }

    async getInstrumentDetails(pair) {
        const normalized = this.normalizeSymbol(pair);
        const info = await this.getExchangeInfo();
        const details = info.symbols.find(s => s.symbol === normalized);
        if (!details) throw new BinanceError(`Instrument ${pair} not found`);
        return details;
    }

    // Advanced Stats
    async getOpenInterestHistory(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/openInterestHist', { symbol, period, ...options }, true);
    }

    async getTopLongShortPositionRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/topLongShortPositionRatio', { symbol, period, ...options }, true);
    }

    async getTakerBuySellVolume(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/takerlongshortRatio', { symbol, period, ...options }, true);
    }

    // --- Authenticated Account & Trading ---

    async getBalance() { return this._request('GET', '/fapi/v2/balance', {}, false); }
    async getAccount() { return this._request('GET', '/fapi/v2/account', {}, false); }

    async getPositionRisk(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/positionRisk', params, false);
    }

    async setLeverage(pair, leverage) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/leverage', { symbol, leverage }, false);
    }

    async createOrder(params) {
        if (params.pair) {
            params.symbol = this.normalizeSymbol(params.pair);
            delete params.pair;
        }
        return this._request('POST', '/fapi/v1/order', params, false);
    }

    async getOrder(pair, orderId, origClientOrderId) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('GET', '/fapi/v1/order', params, false);
    }

    async cancelOrder(pair, orderId, origClientOrderId) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('DELETE', '/fapi/v1/order', params, false);
    }

    async getOpenOrders(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/openOrders', params, false);
    }

    async getPositionMode() { return this._request('GET', '/fapi/v1/positionSide/dual', {}, false); }
    async setPositionMode(dualSidePosition) { return this._request('POST', '/fapi/v1/positionSide/dual', { dualSidePosition }, false); }

    // --- WebSocket Implementation ---

    _normalizeCandle(data, pair) {
        const k = data.k;
        return {
            channel: this.wsEvents.candles,
            eventTime: data.E,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            openTime: k.t,
            closeTime: k.T,
            pair: pair,
            symbol: k.s,
            raw: data
        };
    }

    _normalizeDepth(data) {
        const mapLevels = (lvls) => lvls.map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) }));
        return {
            timestamp: data.E,
            bids: mapLevels(data.b),
            asks: mapLevels(data.a),
            symbol: data.s,
            raw: data
        };
    }

    _normalizeTrade(data) {
        return {
            timestamp: data.E,
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            isMaker: data.m,
            symbol: data.s,
            raw: data
        };
    }

    _normalizeUserData(data) {
        // Broadly map USER_DATA events to CoinDCX-like names if possible
        if (data.e === 'ORDER_TRADE_UPDATE') {
            return { event: this.wsEvents.accountOrder, data };
        } else if (data.e === 'ACCOUNT_UPDATE') {
            return { event: this.wsEvents.accountBalance, data };
        }
        return { event: 'userData', data };
    }

    subscribeMarketStream(stream, pair, type) {
        const url = `${this.wsBase}/${stream}`;
        const ws = new WebSocket(url);

        ws.on('open', () => this._log(`WS Connected: ${stream}`));
        ws.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            let normalized = data;
            let event = type;

            if (type === 'candlestick') normalized = this._normalizeCandle(data, pair);
            else if (type === 'depth') normalized = this._normalizeDepth(data);
            else if (type === 'trade') normalized = this._normalizeTrade(data);

            this.emit(`ws:${event}`, normalized);
            this.emit(stream, normalized);
        });

        return ws;
    }

    wsSubscribeCandles(pair, interval = '1m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@kline_${interval}`, pair, 'candlestick');
    }

    wsSubscribeOrderBook(pair, depth = 20) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@depth${depth}`, pair, 'depth');
    }

    wsSubscribeTrades(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@aggTrade`, pair, 'trade');
    }

    async subscribeUserStream() {
        if (!this.listenKey) {
            const res = await this._request('POST', '/fapi/v1/listenKey', {}, true);
            this.listenKey = res.listenKey;
            this.listenKeyInterval = setInterval(() => {
                this._request('PUT', '/fapi/v1/listenKey', { listenKey: this.listenKey }, true)
                    .catch(e => this._log('ListenKey renewal failed', e));
            }, 30 * 60 * 1000);
        }

        const url = `${this.wsUserBase}/${this.listenKey}`;
        this.ws = new WebSocket(url);

        this.ws.on('message', (msg) => {
            const data = JSON.parse(msg.toString());
            const { event, data: normalized } = this._normalizeUserData(data);
            this.emit(`ws:${event}`, normalized);
            this.emit('userData', data);
        });

        return this.ws;
    }
}

module.exports = {
    BinanceFuturesClient,
    BinanceError,
    BinanceAPIError,
    BinanceNetworkError
};
