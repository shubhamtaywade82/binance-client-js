const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Binance USDⓈ-M Futures Client Library (REST + WebSocket)
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
     * @param {boolean} [options.debug=false] - Enable console logging.
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
    }

    // --- Private Helpers ---

    /**
     * Logs debug messages if enabled.
     * @param {...any} args 
     */
    _log(...args) {
        if (this.debug) {
            console.log('[BinanceFuturesClient]', ...args);
        }
    }

    /**
     * Generates HMAC SHA256 signature.
     * @param {string} queryString 
     * @returns {string}
     */
    _sign(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * Standard request handler.
     * @param {string} method 
     * @param {string} endpoint 
     * @param {Object} params 
     * @param {boolean} signed 
     * @returns {Promise<any>}
     */
    async _request(method, endpoint, params = {}, signed = false) {
        const url = `${this.apiBase}${endpoint}`;
        const timestamp = Date.now();
        
        let queryParams = { ...params };
        
        if (signed) {
            queryParams.timestamp = timestamp;
            queryParams.recvWindow = this.recvWindow;
            const queryString = Object.entries(queryParams)
                .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
                .join('&');
            queryParams.signature = this._sign(queryString);
        }

        this._log(`${method} ${url}`, queryParams);

        try {
            const response = await axios({
                method,
                url,
                params: method === 'GET' ? queryParams : {},
                data: method !== 'GET' ? new URLSearchParams(queryParams).toString() : null,
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        } catch (error) {
            const errorData = error.response ? error.response.data : error.message;
            this._log('Request Error:', errorData);
            throw errorData;
        }
    }

    // --- Public API Methods ---

    // Market Data

    async getPing() {
        return this._request('GET', '/fapi/v1/ping');
    }

    async getTime() {
        return this._request('GET', '/fapi/v1/time');
    }

    async getExchangeInfo() {
        return this._request('GET', '/fapi/v1/exchangeInfo');
    }

    async getOrderBook(symbol, limit = 100) {
        return this._request('GET', '/fapi/v1/depth', { symbol, limit });
    }

    async getRecentTrades(symbol, limit = 500) {
        return this._request('GET', '/fapi/v1/trades', { symbol, limit });
    }

    async getKlines(symbol, interval, options = {}) {
        return this._request('GET', '/fapi/v1/klines', { symbol, interval, ...options });
    }

    async getTickerPrice(symbol) {
        return this._request('GET', '/fapi/v1/ticker/price', symbol ? { symbol } : {});
    }

    async getOpenInterest(symbol) {
        return this._request('GET', '/fapi/v1/openInterest', { symbol });
    }

    async getFundingRate(symbol, limit = 100) {
        return this._request('GET', '/fapi/v1/fundingRate', { symbol, limit });
    }

    async getMarkPrice(symbol) {
        return this._request('GET', '/fapi/v1/premiumIndex', symbol ? { symbol } : {});
    }

    // Account & Trade (Signed)

    async getAccount() {
        return this._request('GET', '/fapi/v2/account', {}, true);
    }

    async getBalance() {
        return this._request('GET', '/fapi/v2/balance', {}, true);
    }

    async getPositionRisk(symbol) {
        return this._request('GET', '/fapi/v2/positionRisk', symbol ? { symbol } : {}, true);
    }

    async createOrder(params) {
        return this._request('POST', '/fapi/v1/order', params, true);
    }

    async cancelOrder(symbol, orderId, origClientOrderId) {
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('DELETE', '/fapi/v1/order', params, true);
    }

    async getOrder(symbol, orderId, origClientOrderId) {
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('GET', '/fapi/v1/order', params, true);
    }

    async getOpenOrders(symbol) {
        return this._request('GET', '/fapi/v1/openOrders', symbol ? { symbol } : {}, true);
    }

    async getAllOrders(symbol, options = {}) {
        return this._request('GET', '/fapi/v1/allOrders', { symbol, ...options }, true);
    }

    // --- WebSocket Methods ---

    /**
     * Connect to a public stream.
     * @param {string} stream - Stream name (e.g., 'btcusdt@aggTrade')
     * @param {Function} callback - Callback for messages
     */
    subscribeMarketStream(stream, callback) {
        const url = `${this.wsBase}/${stream}`;
        const ws = new WebSocket(url);

        ws.on('open', () => this._log(`Connected to market stream: ${stream}`));
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            callback(msg);
            this.emit(stream, msg);
        });
        ws.on('error', (err) => this._log(`WS Error (${stream}):`, err));
        ws.on('close', () => this._log(`WS Closed (${stream})`));

        return ws;
    }

    /**
     * Create a listen key for user data stream.
     * @returns {Promise<string>}
     */
    async createListenKey() {
        const response = await this._request('POST', '/fapi/v1/listenKey', {}, false);
        this.listenKey = response.listenKey;
        return this.listenKey;
    }

    /**
     * Keep-alive for user data stream listen key.
     */
    async keepAliveListenKey() {
        await this._request('PUT', '/fapi/v1/listenKey', {}, false);
    }

    /**
     * Close user data stream listen key.
     */
    async closeListenKey() {
        await this._request('DELETE', '/fapi/v1/listenKey', {}, false);
    }

    /**
     * Connect to user data stream.
     * @param {Function} callback - Callback for messages
     */
    async subscribeUserStream(callback) {
        if (!this.listenKey) {
            await this.createListenKey();
        }

        // Keep-alive every 30 minutes
        this.listenKeyInterval = setInterval(() => {
            this.keepAliveListenKey().catch(err => this._log('Keep-alive failed:', err));
        }, 30 * 60 * 1000);

        const url = `${this.wsUserBase}/${this.listenKey}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => this._log('Connected to user stream'));
        this.ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            callback(msg);
            this.emit('userData', msg);
        });
        this.ws.on('error', (err) => this._log('User WS Error:', err));
        this.ws.on('close', () => {
            this._log('User WS Closed');
            clearInterval(this.listenKeyInterval);
        });

        return this.ws;
    }
}

module.exports = BinanceFuturesClient;
