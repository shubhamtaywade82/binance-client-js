const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Base class for Binance USDⓈ-M Futures Client
 * Provides core functionality for HTTP requests and WebSocket connections
 * Public methods are accessible without credentials
 * Private methods require API Key and Secret
 */
class BinanceBase extends EventEmitter {
    /**
     * @param {Object} config - Configuration options
     * @param {string} [config.apiKey=''] - Binance API Key
     * @param {string} [config.apiSecret=''] - Binance API Secret
     * @param {boolean} [config.testnet=false] - Use testnet environment
     * @param {boolean} [config.demo=false] - Use demo environment
     * @param {boolean} [config.debug=false] - Enable debug logging
     * @param {number} [config.recvWindow=5000] - Request validity window in ms
     */
    constructor(config = {}) {
        super();
        this.apiKey = config.apiKey || '';
        this.apiSecret = config.apiSecret || '';
        this.testnet = config.testnet || false;
        this.demo = config.demo || false;
        this.debug = config.debug || false;
        this.recvWindow = config.recvWindow || 5000;

        // REST API Base URLs
        this.apiBase = config.apiBase || (this.demo
            ? 'https://demo-fapi.binance.com'
            : this.testnet
                ? 'https://testnet.binancefuture.com'
                : 'https://fapi.binance.com');

        // WebSocket Base URLs
        this.wsBase = config.wsBase || (this.demo
            ? 'wss://demo-fstream.binance.com/ws'
            : this.testnet
                ? 'wss://fstream.binancefuture.com/ws'
                : 'wss://fstream.binance.com/ws');

        this.wsUserBase = config.wsUserBase || this.wsBase;
        this.wsApiBase = config.wsApiBase || (this.demo
            ? 'wss://demo-fapi.binance.com/ws-fapi/v1'
            : 'wss://ws-fapi.binance.com/ws-fapi/v1');

        // WebSocket connections management
        this.wsConnections = new Set();
        this.listenKey = null;
        this.listenKeyInterval = null;

        // Event name mappings
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

    /**
     * Check if credentials are configured
     * @returns {boolean}
     */
    hasCredentials() {
        return !!(this.apiKey && this.apiSecret);
    }

    /**
     * Validate that credentials are present for private endpoints
     * @throws {Error} If credentials are missing
     */
    requireAuth() {
        if (!this.hasCredentials()) {
            throw new Error('API Key and Secret required for this operation');
        }
    }

    /**
     * Debug logging utility
     * @param {...any} args - Arguments to log
     */
    _log(...args) {
        if (this.debug) {
            console.log(`[Binance-Futures] ${new Date().toISOString()}`, ...args);
        }
    }

    /**
     * Normalize symbol format (e.g., 'B-BTC_USDT' -> 'BTCUSDT')
     * @param {string} pair - Symbol pair
     * @returns {string} Normalized symbol
     */
    normalizeSymbol(pair) {
        if (!pair) return '';
        return pair.replace(/^B-/, '').replace('_', '').toUpperCase();
    }

    /**
     * Build query string from object
     * @param {Object} data - Data object
     * @returns {string} Query string
     */
    _buildQueryString(data = {}) {
        return Object.entries(data)
            .filter(([, val]) => val !== undefined && val !== null)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&');
    }

    /**
     * Generate HMAC-SHA256 signature
     * @param {string} queryString - Query string to sign
     * @returns {string} Signature
     */
    _generateSignature(queryString) {
        if (!this.apiSecret) {
            throw new Error('API secret missing');
        }
        return crypto.createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * Generic HTTP request handler with auto-signing
     * @param {string} method - HTTP method
     * @param {string} path - API endpoint path
     * @param {Object} [data={}] - Request data
     * @param {boolean} [isPublic=true] - Whether endpoint is public (no auth required)
     * @returns {Promise<any>} Response data
     */
    async _request(method, path, data = {}, isPublic = true) {
        const requestData = { ...data };
        const url = `${this.apiBase}${path}`;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Binance-Node-Client/2.0.0'
        };

        // Add API key header if available
        if (this.apiKey) {
            headers['X-MBX-APIKEY'] = this.apiKey;
        }

        let queryString = '';

        // Sign request if not public
        if (!isPublic) {
            this.requireAuth();
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
                    method,
                    url
                );
            }
            throw new BinanceNetworkError(error.message, error);
        }
    }

    /**
     * Subscribe to market data WebSocket stream
     * @param {string} stream - Stream name
     * @param {string|null} pair - Trading pair
     * @param {string} eventType - Event type for emission
     * @returns {WebSocket} WebSocket connection
     */
    subscribeMarketStream(stream, pair, eventType) {
        const wsUrl = `${this.wsBase}/${stream}`;
        this._log(`Subscribing to market stream: ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        this.wsConnections.add(ws);

        ws.on('open', () => {
            this._log(`Market stream connected: ${stream}`);
            this.emit('connected', { stream, type: 'market' });
        });

        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                this.emit(eventType, parsed, pair);
            } catch (err) {
                this.emit('error', { message: 'Parse error', error: err, stream });
            }
        });

        ws.on('error', (err) => {
            this._log(`Market stream error: ${stream}`, err.message);
            this.emit('error', { message: err.message, stream, type: 'market' });
        });

        ws.on('close', () => {
            this._log(`Market stream closed: ${stream}`);
            this.wsConnections.delete(ws);
            this.emit('disconnected', { stream, type: 'market' });
        });

        return ws;
    }

    /**
     * Close all WebSocket connections
     */
    closeAllWebSockets() {
        for (const ws of this.wsConnections) {
            ws.close();
        }
        if (this.listenKeyInterval) {
            clearInterval(this.listenKeyInterval);
        }
        this.wsConnections.clear();
        this._log('All WebSocket connections closed');
    }

    // Static utilities
    static nowSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    static buildPair(base, target, ecode = 'B') {
        return `${ecode}-${base}_${target}`;
    }

    static parsePair(pair) {
        const match = pair.match(/^([A-Z])-([A-Z0-9]+)_([A-Z0-9]+)$/);
        if (match) {
            return { ecode: match[1], base: match[2], target: match[3] };
        }
        return null;
    }

    static calculateLiquidationPrice(entryPrice, leverage, side, mm = 0.005) {
        const dir = side.toLowerCase() === 'buy' || side.toLowerCase() === 'long' ? 1 : -1;
        if (dir === 1) {
            return entryPrice * (1 - (1 / leverage) + mm);
        } else {
            return entryPrice * (1 + (1 / leverage) - mm);
        }
    }
}

// Custom Errors
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

module.exports = {
    BinanceBase,
    BinanceError,
    BinanceAPIError,
    BinanceNetworkError
};
