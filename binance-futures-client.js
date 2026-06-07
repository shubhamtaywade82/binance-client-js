const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Binance USDⓈ-M Futures Client Library (REST + WebSocket)
 *
 * Provides a unified interface for Binance USDⓈ-M Futures APIs.
 * Includes automatic signature generation and robust WebSocket handling.
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
    }

    // --- Private Helpers ---

    _log(...args) {
        if (this.debug) {
            console.log('[Binance-Futures-Client]', ...args);
        }
    }

    /**
     * Internal: Generates HMAC-SHA256 signature for requests.
     * @param {string} queryString 
     * @returns {string}
     * @private
     */
    _generateSignature(queryString) {
        if (!this.apiSecret) {
            throw new Error('API secret required for authenticated requests');
        }
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * Internal: Generic request handler with auto-signing.
     * @private
     */
    async _request(method, path, data = {}, isPublic = false) {
        const url = `${this.apiBase}${path}`;
        const headers = {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        let queryString = '';
        if (!isPublic) {
            if (!this.apiKey || !this.apiSecret) {
                throw new Error('API Key and Secret are required for authenticated requests');
            }
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
            });
            return response.data;
        } catch (error) {
            const errorData = error.response ? error.response.data : error.message;
            this._log(`Request Error:`, errorData);
            throw errorData;
        }
    }

    // --- Public Market Data ---

    async getPing() {
        return this._request('GET', '/fapi/v1/ping', {}, true);
    }

    async getServerTime() {
        return this._request('GET', '/fapi/v1/time', {}, true);
    }

    async getExchangeInfo() {
        return this._request('GET', '/fapi/v1/exchangeInfo', {}, true);
    }

    async getOrderBook(symbol, limit = 100) {
        return this._request('GET', '/fapi/v1/depth', { symbol, limit }, true);
    }

    async getKlines(symbol, interval, options = {}) {
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/klines', params, true);
    }

    async getTickerPrice(symbol) {
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/price', params, true);
    }

    async getMarkPrice(symbol) {
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/premiumIndex', params, true);
    }

    async getFundingRateHistory(symbol, limit = 100) {
        return this._request('GET', '/fapi/v1/fundingRate', { symbol, limit }, true);
    }

    // --- Authenticated Account & Trading ---

    async getBalance() {
        return this._request('GET', '/fapi/v2/balance', {}, false);
    }

    async getAccount() {
        return this._request('GET', '/fapi/v2/account', {}, false);
    }

    async getPositionRisk(symbol) {
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/positionRisk', params, false);
    }

    async setLeverage(symbol, leverage) {
        return this._request('POST', '/fapi/v1/leverage', { symbol, leverage }, false);
    }

    async createOrder(params) {
        return this._request('POST', '/fapi/v1/order', params, false);
    }

    async getOrder(symbol, orderId, origClientOrderId) {
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('GET', '/fapi/v1/order', params, false);
    }

    async cancelOrder(symbol, orderId, origClientOrderId) {
        const params = { symbol };
        if (orderId) params.orderId = orderId;
        if (origClientOrderId) params.origClientOrderId = origClientOrderId;
        return this._request('DELETE', '/fapi/v1/order', params, false);
    }

    async getOpenOrders(symbol) {
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/openOrders', params, false);
    }

    async getAllOrders(symbol, options = {}) {
        const params = { symbol, ...options };
        return this._request('GET', '/fapi/v1/allOrders', params, false);
    }

    // --- WebSocket Implementation ---

    /**
     * Connects to a public WebSocket stream.
     * @param {string} stream - Stream name (e.g., 'btcusdt@aggTrade')
     * @returns {WebSocket}
     */
    subscribeMarketStream(stream) {
        const url = `${this.wsBase}/${stream}`;
        const ws = new WebSocket(url);

        ws.on('open', () => {
            this._log(`WS Market Connected: ${stream}`);
            this.emit('ws:market:connect', { stream });
        });

        ws.on('message', (data) => {
            const parsed = JSON.parse(data.toString());
            this.emit(stream, parsed);
        });

        ws.on('error', (err) => {
            this._log(`WS Market Error (${stream}):`, err.message);
            this.emit('ws:market:error', { stream, error: err });
        });

        ws.on('close', () => {
            this._log(`WS Market Closed: ${stream}`);
            this.emit('ws:market:close', { stream });
        });

        return ws;
    }

    /**
     * Manages User Data Stream (ListenKey life cycle + WebSocket).
     * @returns {Promise<WebSocket>}
     */
    async subscribeUserStream() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return this.ws;

        // 1. Create ListenKey
        const { listenKey } = await this._request('POST', '/fapi/v1/listenKey', {}, true);
        this.listenKey = listenKey;
        this._log('Created ListenKey:', this.listenKey);

        // 2. Setup Keep-alive (every 30 mins)
        this.listenKeyInterval = setInterval(async () => {
            try {
                await this._request('PUT', '/fapi/v1/listenKey', { listenKey: this.listenKey }, true);
                this._log('Renewed ListenKey');
            } catch (err) {
                this._log('Failed to renew ListenKey:', err.message);
            }
        }, 30 * 60 * 1000);

        // 3. Connect to User Stream
        const url = `${this.wsUserBase}/${this.listenKey}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this._log('WS User Connected');
            this.emit('ws:user:connect', { listenKey: this.listenKey });
        });

        this.ws.on('message', (data) => {
            const parsed = JSON.parse(data.toString());
            this.emit('userData', parsed);
            if (parsed.e) this.emit(parsed.e, parsed);
        });

        this.ws.on('error', (err) => {
            this._log('WS User Error:', err.message);
            this.emit('ws:user:error', { error: err });
        });

        this.ws.on('close', () => {
            this._log('WS User Closed');
            this.emit('ws:user:close');
            this.unsubscribeUserStream();
        });

        return this.ws;
    }

    /**
     * Closes the User Data Stream and clears intervals.
     */
    async unsubscribeUserStream() {
        if (this.listenKeyInterval) {
            clearInterval(this.listenKeyInterval);
            this.listenKeyInterval = null;
        }

        if (this.listenKey) {
            try {
                await this._request('DELETE', '/fapi/v1/listenKey', { listenKey: this.listenKey }, true);
                this._log('Deleted ListenKey');
            } catch (err) {
                this._log('Failed to delete ListenKey:', err.message);
            }
            this.listenKey = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = BinanceFuturesClient;
