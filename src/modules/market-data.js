const { BinanceBase } = require('../base');

/**
 * Market Data Module - Public REST API endpoints
 * All methods in this module are accessible without API credentials
 */
class MarketData extends BinanceBase {
    /**
     * Test connectivity to the REST API
     * @returns {Promise<Object>} Empty object on success
     */
    async getPing() {
        return this._request('GET', '/fapi/v1/ping', {}, true);
    }

    /**
     * Get current server time
     * @returns {Promise<Object>} Server time
     */
    async getServerTime() {
        return this._request('GET', '/fapi/v1/time', {}, true);
    }

    /**
     * Get exchange information including symbols, filters, and limits
     * @returns {Promise<Object>} Exchange info
     */
    async getExchangeInfo() {
        return this._request('GET', '/fapi/v1/exchangeInfo', {}, true);
    }

    /**
     * Get order book depth
     * @param {string} pair - Trading pair (e.g., 'BTCUSDT')
     * @param {number} [limit=100] - Depth limit
     * @returns {Promise<Object>} Order book
     */
    async getOrderBook(pair, limit = 100) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/depth', { symbol, limit }, true);
    }

    /**
     * Get recent trades
     * @param {string} pair - Trading pair
     * @param {number} [limit=500] - Number of trades
     * @returns {Promise<Array>} Recent trades
     */
    async getTrades(pair, limit = 500) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/trades', { symbol, limit }, true);
    }

    /**
     * Get historical trades
     * @param {string} pair - Trading pair
     * @param {number} [limit=500] - Number of trades
     * @param {number|null} [fromId=null] - Trade ID to fetch from
     * @returns {Promise<Array>} Historical trades
     */
    async getHistoricalTrades(pair, limit = 500, fromId = null) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, limit };
        if (fromId) params.fromId = fromId;
        return this._request('GET', '/fapi/v1/historicalTrades', params, true);
    }

    /**
     * Get compressed aggregate trades
     * @param {string} pair - Trading pair
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Aggregate trades
     */
    async getAggregateTrades(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/aggTrades', { symbol, ...options }, true);
    }

    /**
     * Get candlestick data
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval
     * @param {Object} [options] - Additional parameters (startTime, endTime, limit)
     * @returns {Promise<Array>} Candlestick data
     */
    async getKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/klines', params, true);
    }

    /**
     * Get continuous contract candlestick data
     * @param {string} pair - Trading pair
     * @param {string} contractType - Contract type (CURRENT_QUARTER, NEXT_QUARTER, PERPETUAL)
     * @param {string} interval - Kline interval
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Continuous contract klines
     */
    async getContinuousKlines(pair, contractType, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { pair: symbol, contractType, interval, ...options };
        return this._request('GET', '/fapi/v1/continuousKlines', params, true);
    }

    /**
     * Get index price candlestick data
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Index price klines
     */
    async getIndexPriceKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { pair: symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/indexPriceKlines', params, true);
    }

    /**
     * Get mark price candlestick data
     * @param {string} pair - Trading pair
     * @param {string} interval - Kline interval
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Mark price klines
     */
    async getMarkPriceKlines(pair, interval, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        const params = { symbol, interval, ...options };
        return this._request('GET', '/fapi/v1/markPriceKlines', params, true);
    }

    /**
     * Get symbol price ticker
     * @param {string|null} pair - Trading pair (null for all symbols)
     * @returns {Promise<Object|Array>} Price ticker
     */
    async getTickerPrice(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/price', params, true);
    }

    /**
     * Get 24-hour rolling window price change statistics
     * @param {string|null} pair - Trading pair (null for all symbols)
     * @returns {Promise<Object|Array>} 24hr ticker
     */
    async getTicker24h(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/24hr', params, true);
    }

    /**
     * Get best price/qty on the order book
     * @param {string|null} pair - Trading pair (null for all symbols)
     * @returns {Promise<Object|Array>} Book ticker
     */
    async getBookTicker(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/ticker/bookTicker', params, true);
    }

    /**
     * Get trading day ticker
     * @param {string|null} pair - Trading pair (null for all symbols)
     * @returns {Promise<Object|Array>} Trading day ticker
     */
    async getTradingDayTicker(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/tradingDayTicker', params, true);
    }

    /**
     * Get mark price and funding rate
     * @param {string|null} pair - Trading pair (null for all symbols)
     * @returns {Promise<Object|Array>} Mark price data
     */
    async getMarkPrice(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/premiumIndex', params, true);
    }

    /**
     * Get funding rate history
     * @param {string} pair - Trading pair
     * @param {Object} [options] - Additional parameters (startTime, endTime, limit)
     * @returns {Promise<Array>} Funding rate history
     */
    async getFundingRateHistory(pair, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/fundingRate', { symbol, ...options }, true);
    }

    /**
     * Get instrument details
     * @param {string} pair - Trading pair
     * @returns {Promise<Object>} Instrument details
     */
    async getInstrumentDetails(pair) {
        const normalized = this.normalizeSymbol(pair);
        const info = await this.getExchangeInfo();
        const details = info.symbols.find(s => s.symbol === normalized);
        if (!details) {
            throw new Error(`Instrument ${pair} not found`);
        }
        return details;
    }

    /**
     * Get open interest statistics
     * @param {string} pair - Trading pair
     * @param {string} period - Period (5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d)
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Open interest history
     */
    async getOpenInterestHistory(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/openInterestHist', { symbol, period, ...options }, true);
    }

    /**
     * Get top trader long/short position ratio
     * @param {string} pair - Trading pair
     * @param {string} period - Period
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Position ratio
     */
    async getTopLongShortPositionRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/topLongShortPositionRatio', { symbol, period, ...options }, true);
    }

    /**
     * Get taker buy/sell volume ratio
     * @param {string} pair - Trading pair
     * @param {string} period - Period
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Taker volume ratio
     */
    async getTakerBuySellVolume(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/takerlongshortRatio', { symbol, period, ...options }, true);
    }

    /**
     * Get global long/short account ratio
     * @param {string} pair - Trading pair
     * @param {string} period - Period
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Account ratio
     */
    async getGlobalLongShortAccountRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/globalLongShortAccountRatio', { symbol, period, ...options }, true);
    }

    /**
     * Get top trader long/short account ratio
     * @param {string} pair - Trading pair
     * @param {string} period - Period
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Top trader account ratio
     */
    async getTopLongShortAccountRatio(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/topLongShortAccountRatio', { symbol, period, ...options }, true);
    }

    /**
     * Get basis data
     * @param {string} pair - Trading pair
     * @param {string} period - Period
     * @param {Object} [options] - Additional parameters
     * @returns {Promise<Array>} Basis data
     */
    async getBasis(pair, period, options = {}) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/futures/data/basis', { symbol, period, ...options }, true);
    }

    /**
     * Get asset index
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Asset index
     */
    async getAssetIndex(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/assetIndex', params, true);
    }

    /**
     * Get composite index info
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Composite index info
     */
    async getCompositeIndexInfo(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/indexInfo', params, true);
    }

    /**
     * Get current open interest
     * @param {string} pair - Trading pair
     * @returns {Promise<Object>} Open interest
     */
    async getOpenInterest(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/openInterest', { symbol }, true);
    }

    /**
     * Get funding info
     * @returns {Promise<Array>} Funding info
     */
    async getFundingInfo() {
        return this._request('GET', '/fapi/v1/fundingInfo', {}, true);
    }

    /**
     * Get price ticker v2
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Price ticker v2
     */
    async getTickerPriceV2(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/ticker/price', params, true);
    }

    /**
     * Get book ticker v2
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Book ticker v2
     */
    async getBookTickerV2(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/ticker/bookTicker', params, true);
    }

    /**
     * Get BLVT info
     * @param {string|null} tokenName - Token name (null for all)
     * @returns {Promise<Object|Array>} BLVT info
     */
    async getBlvtInfo(tokenName) {
        const params = tokenName ? { tokenName } : {};
        return this._request('GET', '/fapi/v1/lvtKlines', params, true);
    }

    /**
     * Get index price constituents
     * @param {string} pair - Trading pair
     * @returns {Promise<Object>} Constituents
     */
    async getIndexPriceConstituents(pair) {
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/constituents', { symbol }, true);
    }

    /**
     * Get symbol configuration
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Symbol config
     */
    async getSymbolConfig(pair) {
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/symbolConfig', params, true);
    }

    /**
     * Get quantitative rules
     * @returns {Promise<Array>} Quantitative rules
     */
    async getQuantitativeRules() {
        return this._request('GET', '/fapi/v1/quantitativeRules', {}, true);
    }

    /**
     * Get forced orders (liquidation orders)
     * @param {Object} [options] - Parameters (symbol, startTime, endTime, limit)
     * @returns {Promise<Array>} Forced orders
     */
    async getForceOrders(options = {}) {
        if (options.pair) {
            options.symbol = this.normalizeSymbol(options.pair);
            delete options.pair;
        }
        return this._request('GET', '/fapi/v1/forceOrders', options, true);
    }
}

module.exports = { MarketData };
