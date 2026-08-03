const { BinanceBase } = require('../base');

/**
 * Trading Module - Private REST API endpoints for order management
 * All methods in this module REQUIRE API credentials
 */
class Trading extends BinanceBase {
    /**
     * Place a new order
     * @param {Object} params - Order parameters
     * @returns {Promise<Object>} Order response
     */
    async placeOrder(params) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(params.pair || params.symbol);
        const { pair, ...orderParams } = params;
        return this._request('POST', '/fapi/v1/order', { symbol, ...orderParams }, false);
    }

    /**
     * Cancel an existing order
     * @param {string} pair - Trading pair
     * @param {Object} params - Cancel parameters (orderId or origClientOrderId)
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelOrder(pair, params = {}) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('DELETE', '/fapi/v1/order', { symbol, ...params }, false);
    }

    /**
     * Cancel all open orders for a symbol
     * @param {string} pair - Trading pair
     * @returns {Promise<Object>} Cancellation response
     */
    async cancelAllOrders(pair) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('DELETE', '/fapi/v1/allOpenOrders', { symbol }, false);
    }

    /**
     * Query current open order
     * @param {string} pair - Trading pair
     * @param {Object} params - Query parameters (orderId or origClientOrderId)
     * @returns {Promise<Object>} Order details
     */
    async queryOrder(pair, params = {}) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/order', { symbol, ...params }, false);
    }

    /**
     * Get all open orders
     * @param {Object} [params] - Additional parameters (symbol, type)
     * @returns {Promise<Array>} Open orders
     */
    async getOpenOrders(params = {}) {
        this.requireAuth();
        if (params.pair) {
            params.symbol = this.normalizeSymbol(params.pair);
            delete params.pair;
        }
        return this._request('GET', '/fapi/v1/openOrders', params, false);
    }

    /**
     * Get all orders (including filled, canceled, expired)
     * @param {Object} params - Query parameters (symbol required)
     * @returns {Promise<Array>} All orders
     */
    async getAllOrders(params) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(params.pair || params.symbol);
        const { pair, ...orderParams } = params;
        return this._request('GET', '/fapi/v1/allOrders', { symbol, ...orderParams }, false);
    }

    /**
     * Modify an existing order (cancel and replace)
     * @param {string} pair - Trading pair
     * @param {Object} params - Modify parameters
     * @returns {Promise<Object>} Modification response
     */
    async modifyOrder(pair, params) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('PUT', '/fapi/v1/order', { symbol, ...params }, false);
    }

    /**
     * Place batch orders (up to 5 orders)
     * @param {Array} orders - Array of order objects
     * @returns {Promise<Array>} Batch order results
     */
    async placeBatchOrders(orders) {
        this.requireAuth();
        const normalizedOrders = orders.map(order => ({
            ...order,
            symbol: this.normalizeSymbol(order.pair || order.symbol)
        }));
        const params = { batchOrders: JSON.stringify(normalizedOrders) };
        return this._request('POST', '/fapi/v1/batchOrders', params, false);
    }

    /**
     * Get user's trade history
     * @param {Object} params - Query parameters (symbol required)
     * @returns {Promise<Array>} Trade history
     */
    async getUserTrades(params) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(params.pair || params.symbol);
        const { pair, ...tradeParams } = params;
        return this._request('GET', '/fapi/v1/userTrades', { symbol, ...tradeParams }, false);
    }

    /**
     * Get historical trades for a specific order
     * @param {string} pair - Trading pair
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Order trades
     */
    async getOrderTrades(pair, params = {}) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('GET', '/fapi/v1/userTrades', { symbol, ...params }, false);
    }
}

module.exports = { Trading };
