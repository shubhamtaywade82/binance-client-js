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
        this.demo = options.demo || false;
        this.debug = options.debug || false;
        this.recvWindow = options.recvWindow || 5000;

        this.apiBase = options.apiBase || (this.demo
            ? 'https://demo-fapi.binance.com'
            : this.testnet
                ? 'https://testnet.binancefuture.com'
                : 'https://fapi.binance.com');

        this.wsBase = options.wsBase || (this.demo
            ? 'wss://demo-fstream.binance.com/ws'
            : this.testnet
                ? 'wss://fstream.binancefuture.com/ws'
                : 'wss://fstream.binance.com/ws');

        this.wsUserBase = options.wsUserBase || this.wsBase;
        this.wsApiBase = options.wsApiBase || (this.demo
            ? 'wss://demo-fapi.binance.com/ws-fapi/v1'
            : 'wss://ws-fapi.binance.com/ws-fapi/v1');

        this.ws = null;
        this.wsConnections = new Set();
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
    _buildQueryString(data = {}) {
        return Object.entries(data)
            .filter(([, val]) => val !== undefined && val !== null)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&');
    }

    _generateSignature(queryString) {
        if (!this.apiSecret) throw new BinanceError('API secret missing');
        return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    }

    /**
     * Internal: Generic request handler with auto-signing.
     */
    async _request(method, path, data = {}, isPublic = false) {
        const requestData = { ...data };
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
            requestData.timestamp = Date.now();
            requestData.recvWindow = this.recvWindow;
            
            queryString = this._buildQueryString(requestData);
            
            const signature = this._generateSignature(queryString);
            queryString += `&signature=${signature}`;
        } else {
            queryString = this._buildQueryString(requestData);
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

    async getTrades(pair, limit = 500) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/trades', { symbol, limit }, true);
    }

    async getHistoricalTrades(pair, limit = 500, fromId = null) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, limit };
        if (fromId) params.fromId = fromId;
        return this._request('GET', '/fapi/v1/historicalTrades', params, true);
    }

    async getAggregateTrades(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/aggTrades', { symbol, ...options }, true);
    }

    async getKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/klines', params, true);
    }

    async getContinuousKlines(pair, contractType, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { pair: symbol, contractType, interval, ...options };
        return this._request('GET', '/fapi/v1/continuousKlines', params, true);
    }

    async getIndexPriceKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { pair: symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/indexPriceKlines', params, true);
    }

    async getMarkPriceKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/markPriceKlines', params, true);
    }

    async getTickerPrice(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/price', params, true);
    }

    async getTicker24h(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/24hr', params, true);
    }

    async getBookTicker(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/bookTicker', params, true);
    }

    async getTradingDayTicker(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/tradingDayTicker', params, true);
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

    async getGlobalLongShortAccountRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/globalLongShortAccountRatio', { symbol, period, ...options }, true);
    }

    async getTopLongShortAccountRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/topLongShortAccountRatio', { symbol, period, ...options }, true);
    }

    async getBasis(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/basis', { symbol, period, ...options }, true);
    }

    async getAssetIndex(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/assetIndex', params, true);
    }

    async getCompositeIndexInfo(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/indexInfo', params, true);
    }

    async getAdlQuantile(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/adlQuantile', params, false);
    }

    async getOpenInterest(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/openInterest', { symbol }, true);
    }

    async getFundingInfo() {
        return this._request('GET', '/fapi/v1/fundingInfo', {}, true);
    }

    async getTickerPriceV2(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/ticker/price', params, true);
    }

    async getBookTickerV2(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/ticker/bookTicker', params, true);
    }

    async getBlvtInfo(tokenName) {
        const params = tokenName ? { tokenName } : {};
        return this._request('GET', '/fapi/v1/lvtKlines', params, true);
    }

    async getIndexPriceConstituents(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/constituents', { symbol }, true);
    }

    async getSymbolConfig(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/symbolConfig', params, true);
    }

    async getQuantitativeRules() {
        return this._request('GET', '/fapi/v1/quantitativeRules', {}, true);
    }

    async getForceOrders(options = {}) {
        if (options.pair) {
            options.symbol = this.normalizeSymbol(options.pair);
            delete options.pair;
        }
        return this._request('GET', '/fapi/v1/forceOrders', options, true);
    }

    // Async Data Download
    async requestOrderDownload(options = {}) {
        return this._request('GET', '/fapi/v1/order/asyn', options, false);
    }

    async getOrderDownloadStatus(downloadId) {
        return this._request('GET', '/fapi/v1/order/asyn/id', { downloadId }, false);
    }

    async requestTradeDownload(options = {}) {
        return this._request('GET', '/fapi/v1/trade/asyn', options, false);
    }

    async getTradeDownloadStatus(downloadId) {
        return this._request('GET', '/fapi/v1/trade/asyn/id', { downloadId }, false);
    }

    // --- Authenticated Account & Trading ---

    async getBalance() { return this._request('GET', '/fapi/v2/balance', {}, false); }
    async getAccount() { return this._request('GET', '/fapi/v2/account', {}, false); }

    async getPositionRisk(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/positionRisk', params, false);
    }

    async getAccountV3() { return this._request('GET', '/fapi/v3/account', {}, false); }

    async getBalanceV3() { return this._request('GET', '/fapi/v3/balance', {}, false); }

    async getPositionRiskV3(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v3/positionRisk', params, false);
    }

    async setLeverage(pair, leverage) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/leverage', { symbol, leverage }, false);
    }

    _normalizeParamsWithPair(params = {}) {
        const normalized = { ...params };
        if (normalized.pair) {
            normalized.symbol = this.normalizeSymbol(normalized.pair);
            delete normalized.pair;
        } else if (normalized.symbol) {
            normalized.symbol = this.normalizeSymbol(normalized.symbol);
        }
        return normalized;
    }

    _normalizeOrderParams(params = {}) {
        return this._normalizeParamsWithPair(params);
    }

    async createOrder(params) {
        return this._request('POST', '/fapi/v1/order', this._normalizeOrderParams(params), false);
    }

    async createTestOrder(params) {
        return this._request('POST', '/fapi/v1/order/test', this._normalizeOrderParams(params), false);
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

    async getCurrentOrder(pair, orderId, origClientOrderId) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, orderId, origClientOrderId };
        return this._request('GET', '/fapi/v1/openOrder', params, false);
    }

    async getOpenOrders(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/openOrders', params, false);
    }

    async getAllOrders(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, ...options };
        return this._request('GET', '/fapi/v1/allOrders', params, false);
    }

    async cancelAllOpenOrders(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('DELETE', '/fapi/v1/allOpenOrders', { symbol }, false);
    }

    async modifyOrder(params) {
        return this._request('PUT', '/fapi/v1/order', this._normalizeOrderParams(params), false);
    }

    async createAlgoOrder(params) {
        return this._request('POST', '/fapi/v1/algoOrder', this._normalizeOrderParams(params), false);
    }

    async cancelAlgoOrder(pair, algoId, clientAlgoId) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, algoId, clientAlgoId };
        return this._request('DELETE', '/fapi/v1/algoOrder', params, false);
    }

    async cancelAllOpenAlgoOrders(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('DELETE', '/fapi/v1/algoOpenOrders', { symbol }, false);
    }

    async getAlgoOrder(pair, algoId, clientAlgoId) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/algoOrder', { symbol, algoId, clientAlgoId }, false);
    }

    async getOpenAlgoOrders(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/openAlgoOrders', params, false);
    }

    async getAllAlgoOrders(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/allAlgoOrders', { symbol, ...options }, false);
    }

    async createBatchOrders(batchOrders) {
        const orders = batchOrders.map(o => {
            const order = { ...o };
            if (order.pair) {
                order.symbol = this.normalizeSymbol(order.pair);
                delete order.pair;
            }
            return order;
        });
        return this._request('POST', '/fapi/v1/batchOrders', { batchOrders: JSON.stringify(orders) }, false);
    }

    async getOrderModifyHistory(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/orderAmendment', { symbol, ...options }, false);
    }

    async modifyBatchOrders(batchOrders) {
        const orders = batchOrders.map(o => {
            const order = { ...o };
            if (order.pair) {
                order.symbol = this.normalizeSymbol(order.pair);
                delete order.pair;
            }
            return order;
        });
        return this._request('PUT', '/fapi/v1/batchOrders', { batchOrders: JSON.stringify(orders) }, false);
    }

    async cancelBatchOrders(pair, orderIdList = [], origClientOrderIdList = []) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol };
        if (orderIdList.length > 0) params.orderIdList = JSON.stringify(orderIdList);
        if (origClientOrderIdList.length > 0) params.origClientOrderIdList = JSON.stringify(origClientOrderIdList);
        return this._request('DELETE', '/fapi/v1/batchOrders', params, false);
    }

    async setMarginType(pair, marginType) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/marginType', { symbol, marginType }, false);
    }

    async modifyPositionMargin(pair, amount, type) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/positionMargin', { symbol, amount, type }, false);
    }

    async getMultiAssetsMargin() {
        return this._request('GET', '/fapi/v1/multiAssetsMargin', {}, false);
    }

    async setMultiAssetsMargin(multiAssetsMargin) {
        return this._request('POST', '/fapi/v1/multiAssetsMargin', { multiAssetsMargin }, false);
    }

    async getUserCommissionRate(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/commissionRate', { symbol }, false);
    }

    async getFeeBurnStatus() {
        return this._request('GET', '/fapi/v1/feeBurn', {}, false);
    }

    async setFeeBurnStatus(feeBurn) {
        return this._request('POST', '/fapi/v1/feeBurn', { feeBurn }, false);
    }

    async getUserTrades(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/userTrades', { symbol, ...options }, false);
    }

    async getIncomeHistory(options = {}) {
        if (options.pair) {
            options.symbol = this.normalizeSymbol(options.pair);
            delete options.pair;
        }
        return this._request('GET', '/fapi/v1/income', options, false);
    }

    async getLeverageBrackets(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/leverageBracket', params, false);
    }

    async getApiTradingStatus() {
        return this._request('GET', '/fapi/v1/apiTradingStatus', {}, false);
    }

    async getPositionMarginHistory(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/positionMargin/history', { symbol, ...options }, false);
    }

    async getRateLimitOrder() {
        return this._request('GET', '/fapi/v1/rateLimit/order', {}, false);
    }

    async getInsuranceFundBalance(options = {}) {
        return this._request('GET', '/fapi/v1/insuranceFundBalance', options, true);
    }

    async getPmExchangeInfo() {
        return this._request('GET', '/fapi/v1/pmExchangeInfo', {}, true);
    }

    async getDelistSchedule(pair) {
        const symbol = this.normalizeSymbol(pair);
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/delistSchedule', params, true);
    }

    async setCountdownCancelAll(pair, countdownTime) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/countdownCancelAll', { symbol, countdownTime }, false);
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
        this.wsConnections.add(ws);
        ws.on('close', () => this.wsConnections.delete(ws));

        ws.on('open', () => this._log(`WS Connected: ${stream}`));
        ws.on('message', (msg) => {
            let data;
            try {
                data = JSON.parse(msg.toString());
            } catch (error) {
                this.emit('ws:error', new BinanceNetworkError('Invalid WebSocket JSON payload', error));
                return;
            }
            let normalized = data;
            let event = type;

            if (type === 'candlestick') normalized = this._normalizeCandle(data, pair);
            else if (type === 'depth') normalized = this._normalizeDepth(data);
            else if (type === 'trade') normalized = this._normalizeTrade(data);
            else if (type === 'allLiquidationOrders') {
                normalized = data.o ? {
                    symbol: data.o.s,
                    side: data.o.S,
                    orderType: data.o.o,
                    timeInForce: data.o.f,
                    originalQuantity: data.o.q,
                    price: data.o.p,
                    averagePrice: data.o.ap,
                    orderStatus: data.o.X,
                    lastFilledQuantity: data.o.l,
                    filledAccumulatedQuantity: data.o.z,
                    time: data.o.T,
                    raw: data
                } : data;
            } else if (type === 'compositeIndex') {
                normalized = {
                    symbol: data.s,
                    time: data.E,
                    close: parseFloat(data.p),
                    composition: data.c ? data.c.map(item => ({
                        baseAsset: item.b,
                        quoteAsset: item.q,
                        weight: parseFloat(item.w),
                        price: parseFloat(item.p)
                    })) : [],
                    raw: data
                };
            } else if (type === 'rollingWindowTicker') {
                normalized = {
                    symbol: data.s,
                    openPrice: parseFloat(data.o),
                    highPrice: parseFloat(data.h),
                    lowPrice: parseFloat(data.l),
                    lastPrice: parseFloat(data.c),
                    volume: parseFloat(data.v),
                    quoteVolume: parseFloat(data.q),
                    openTime: data.O,
                    closeTime: data.C,
                    raw: data
                };
            } else if (type === 'markPrice') {
                normalized = {
                    symbol: data.s,
                    markPrice: parseFloat(data.p),
                    indexPrice: parseFloat(data.i),
                    estimatedSettlePrice: parseFloat(data.P),
                    fundingRate: parseFloat(data.r),
                    nextFundingTime: data.T,
                    raw: data
                };
            } else if (type === 'allMarkPrices') {
                normalized = data.map(item => ({
                    symbol: item.s,
                    markPrice: parseFloat(item.p),
                    indexPrice: parseFloat(item.i),
                    estimatedSettlePrice: parseFloat(item.P),
                    fundingRate: parseFloat(item.r),
                    nextFundingTime: item.T,
                    raw: item
                }));
            } else if (type === 'liquidationOrder') {
                const o = data.o;
                normalized = {
                    symbol: o.s,
                    side: o.S,
                    orderType: o.o,
                    timeInForce: o.f,
                    originalQuantity: parseFloat(o.q),
                    price: parseFloat(o.p),
                    averagePrice: parseFloat(o.ap),
                    orderStatus: o.X,
                    lastFilledQuantity: parseFloat(o.l),
                    filledAccumulatedQuantity: parseFloat(o.z),
                    time: o.T,
                    raw: data
                };
            } else if (type === 'miniTicker') {
                normalized = {
                    symbol: data.s,
                    closePrice: parseFloat(data.c),
                    openPrice: parseFloat(data.o),
                    highPrice: parseFloat(data.h),
                    lowPrice: parseFloat(data.l),
                    volume: parseFloat(data.v),
                    quoteVolume: parseFloat(data.q),
                    eventTime: data.E,
                    raw: data
                };
            } else if (type === 'allMiniTickers') {
                normalized = data.map(item => ({
                    symbol: item.s,
                    closePrice: parseFloat(item.c),
                    openPrice: parseFloat(item.o),
                    highPrice: parseFloat(item.h),
                    lowPrice: parseFloat(item.l),
                    volume: parseFloat(item.v),
                    quoteVolume: parseFloat(item.q),
                    eventTime: item.E,
                    raw: item
                }));
            } else if (type === 'assetIndex' || type === 'allAssetIndices') {
                const mapAsset = (item) => ({
                    asset: item.s,
                    indexPrice: parseFloat(item.i),
                    bidPrice: parseFloat(item.b),
                    askPrice: parseFloat(item.a),
                    raw: item
                });
                normalized = Array.isArray(data) ? data.map(mapAsset) : mapAsset(data);
            }

            this.emit(`ws:${event}`, normalized);
            this.emit(stream, normalized);
        });

        return ws;
    }

    subscribeCombinedMarketStreams(streams = []) {
        const normalizedStreams = streams.map(stream => stream.toLowerCase()).join('/');
        const base = this.wsBase.replace(/\/ws$/, '/stream');
        const url = `${base}?streams=${normalizedStreams}`;
        const ws = new WebSocket(url);
        this.wsConnections.add(ws);
        ws.on('close', () => this.wsConnections.delete(ws));
        ws.on('message', (msg) => {
            let packet;
            try {
                packet = JSON.parse(msg.toString());
            } catch (error) {
                this.emit('ws:error', new BinanceNetworkError('Invalid combined WebSocket JSON payload', error));
                return;
            }
            this.emit(packet.stream, packet.data);
            this.emit('ws:combined', packet);
        });
        return ws;
    }

    async wsApiRequest(method, params = {}) {
        if (!this.apiKey || !this.apiSecret) throw new BinanceError('API Key/Secret required');
        const { id: requestId, ...methodParams } = params;
        const requestParams = { ...methodParams, apiKey: this.apiKey, timestamp: Date.now(), recvWindow: this.recvWindow };
        const queryString = this._buildQueryString(requestParams);
        requestParams.signature = this._generateSignature(queryString);
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.wsApiBase);
            const id = requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const timeout = setTimeout(() => {
                ws.close();
                reject(new BinanceNetworkError(`WebSocket API request timed out: ${method}`));
            }, 15000);
            ws.on('open', () => ws.send(JSON.stringify({ id, method, params: requestParams })));
            ws.on('message', (msg) => {
                clearTimeout(timeout);
                ws.close();
                let data;
                try {
                    data = JSON.parse(msg.toString());
                } catch (error) {
                    reject(new BinanceNetworkError('Invalid WebSocket API JSON payload', error));
                    return;
                }
                if (data.status && data.status >= 400) {
                    reject(new BinanceAPIError(data.error?.msg || 'WebSocket API error', data.status, data.error, 'WS', this.wsApiBase));
                } else {
                    resolve(data);
                }
            });
            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(new BinanceNetworkError(err.message, err));
            });
        });
    }

    wsApiCreateOrder(params) {
        return this.wsApiRequest('order.place', this._normalizeOrderParams(params));
    }

    wsApiCancelOrder(params) {
        return this.wsApiRequest('order.cancel', this._normalizeOrderParams(params));
    }

    wsApiModifyOrder(params) {
        return this.wsApiRequest('order.modify', this._normalizeOrderParams(params));
    }

    wsApiCreateAlgoOrder(params) {
        return this.wsApiRequest('algoOrder.place', this._normalizeOrderParams(params));
    }

    wsApiCancelAlgoOrder(params) {
        return this.wsApiRequest('algoOrder.cancel', this._normalizeOrderParams(params));
    }

    closeAllWebSockets() {
        for (const ws of this.wsConnections) ws.close();
        if (this.ws) this.ws.close();
        if (this.listenKeyInterval) clearInterval(this.listenKeyInterval);
        this.wsConnections.clear();
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

    subscribeAllMarketTickers() { return this.wsSubscribeAllMarketTickers(); }
    subscribeAllBookTickers() { return this.wsSubscribeAllBookTickers(); }

    wsSubscribeAllMarketTickers() {
        return this.subscribeMarketStream('!ticker@arr', null, 'allMarketTickers');
    }

    wsSubscribeAllBookTickers() {
        return this.subscribeMarketStream('!bookTicker', null, 'allBookTickers');
    }

    wsSubscribeAllLiquidationOrders() {
        return this.subscribeMarketStream('!forceOrder@arr', null, 'allLiquidationOrders');
    }

    wsSubscribeLiquidationOrder(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@forceOrder`, pair, 'liquidationOrder');
    }

    wsSubscribeCompositeIndex(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@compositeIndex`, pair, 'compositeIndex');
    }

    wsSubscribeAllMarkPrices() {
        return this.subscribeMarketStream('!markPrice@arr', null, 'allMarkPrices');
    }

    wsSubscribeAllAssetIndices() {
        return this.subscribeMarketStream('!assetIndex@arr', null, 'allAssetIndices');
    }

    wsSubscribeAssetIndex(asset) {
        const lower = asset.toLowerCase();
        return this.subscribeMarketStream(`${lower}@assetIndex`, asset, 'assetIndex');
    }

    wsSubscribeRollingWindowTicker(pair, window = '1h') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@ticker_${window}`, pair, 'rollingWindowTicker');
    }

    wsSubscribeMarkPrice(pair, speed = '1s') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        const suffix = speed === '1s' ? '@1s' : '';
        return this.subscribeMarketStream(`${symbol}@markPrice${suffix}`, pair, 'markPrice');
    }

    wsSubscribeContinuousCandles(pair, contractType, interval = '1m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        const type = contractType.toLowerCase(); // e.g. 'perpetual'
        return this.subscribeMarketStream(`${symbol}@continuousKline_${type}_${interval}`, pair, 'candlestick');
    }

    wsSubscribeIndexPriceCandles(pair, interval = '1m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@indexPriceKline_${interval}`, pair, 'candlestick');
    }

    wsSubscribeMarkPriceCandles(pair, interval = '1m') {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@markPriceKline_${interval}`, pair, 'candlestick');
    }

    wsSubscribeMiniTicker(pair) {
        const symbol = this.normalizeSymbol(pair).toLowerCase();
        return this.subscribeMarketStream(`${symbol}@miniTicker`, pair, 'miniTicker');
    }

    wsSubscribeAllMiniTickers() {
        return this.subscribeMarketStream('!miniTicker@arr', null, 'allMiniTickers');
    }

    async closeUserStream() {
        if (!this.listenKey) return {};
        const listenKey = this.listenKey;
        if (this.listenKeyInterval) clearInterval(this.listenKeyInterval);
        if (this.ws) this.ws.close();
        this.listenKey = null;
        this.listenKeyInterval = null;
        return this._request('DELETE', '/fapi/v1/listenKey', { listenKey }, true);
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
        this.wsConnections.add(this.ws);
        this.ws.on('close', () => this.wsConnections.delete(this.ws));

        this.ws.on('message', (msg) => {
            let data;
            try {
                data = JSON.parse(msg.toString());
            } catch (error) {
                this.emit('ws:error', new BinanceNetworkError('Invalid user-data WebSocket JSON payload', error));
                return;
            }
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
