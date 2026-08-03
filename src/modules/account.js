const { BinanceBase } = require('../base');

/**
 * Account Module - Private REST API endpoints for account and position management
 * All methods in this module REQUIRE API credentials
 */
class Account extends BinanceBase {
    /**
     * Get current account balance
     * @returns {Promise<Array>} Account balances
     */
    async getBalance() {
        this.requireAuth();
        return this._request('GET', '/fapi/v2/balance', {}, false);
    }

    /**
     * Get current account information
     * @returns {Promise<Object>} Account info
     */
    async getAccount() {
        this.requireAuth();
        return this._request('GET', '/fapi/v2/account', {}, false);
    }

    /**
     * Get account information v3 (newer version)
     * @returns {Promise<Object>} Account info v3
     */
    async getAccountV3() {
        this.requireAuth();
        return this._request('GET', '/fapi/v3/account', {}, false);
    }

    /**
     * Get balance v3 (newer version)
     * @returns {Promise<Array>} Balance v3
     */
    async getBalanceV3() {
        this.requireAuth();
        return this._request('GET', '/fapi/v3/balance', {}, false);
    }

    /**
     * Get position risk for a symbol or all symbols
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Position risk
     */
    async getPositionRisk(pair) {
        this.requireAuth();
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v2/positionRisk', params, false);
    }

    /**
     * Get position risk v3 (newer version)
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} Position risk v3
     */
    async getPositionRiskV3(pair) {
        this.requireAuth();
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v3/positionRisk', params, false);
    }

    /**
     * Set leverage for a symbol
     * @param {string} pair - Trading pair
     * @param {number} leverage - Leverage value (1-125)
     * @returns {Promise<Object>} Leverage response
     */
    async setLeverage(pair, leverage) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/leverage', { symbol, leverage }, false);
    }

    /**
     * Set margin mode (ISOLATED or CROSSED)
     * @param {string} pair - Trading pair
     * @param {number} marginType - 1 for ISOLATED, 2 for CROSSED
     * @returns {Promise<Object>} Margin mode response
     */
    async setMarginMode(pair, marginType) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/marginType', { symbol, marginType }, false);
    }

    /**
     * Add isolated margin to a position
     * @param {string} pair - Trading pair
     * @param {number} amount - Amount to add
     * @param {number} type - 1 for add, 2 for remove
     * @returns {Promise<Object>} Margin adjustment response
     */
    async modifyIsolatedMargin(pair, amount, type = 1) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/positionMargin', { symbol, amount, type }, false);
    }

    /**
     * Get isolated margin adjustment history
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Margin history
     */
    async getMarginHistory(params = {}) {
        this.requireAuth();
        if (params.pair) {
            params.symbol = this.normalizeSymbol(params.pair);
            delete params.pair;
        }
        return this._request('GET', '/fapi/v1/positionMargin/history', params, false);
    }

    /**
     * Get user's income history
     * @param {Object} params - Query parameters (symbol optional)
     * @returns {Promise<Array>} Income history
     */
    async getIncomeHistory(params = {}) {
        this.requireAuth();
        if (params.pair) {
            params.symbol = this.normalizeSymbol(params.pair);
            delete params.pair;
        }
        return this._request('GET', '/fapi/v1/income', params, false);
    }

    /**
     * Get commission rates
     * @param {string|null} pair - Trading pair (optional)
     * @returns {Promise<Object>} Commission rates
     */
    async getCommissionRates(pair) {
        this.requireAuth();
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/commissionRate', params, false);
    }

    /**
     * Get ADL quantile estimate
     * @param {string|null} pair - Trading pair (null for all)
     * @returns {Promise<Object|Array>} ADL quantile
     */
    async getAdlQuantile(pair) {
        this.requireAuth();
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/adlQuantile', params, false);
    }

    /**
     * Get force orders (liquidation orders) for account
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Force orders
     */
    async getForceOrders(params = {}) {
        this.requireAuth();
        if (params.pair) {
            params.symbol = this.normalizeSymbol(params.pair);
            delete params.pair;
        }
        return this._request('GET', '/fapi/v1/forceOrders', params, false);
    }

    /**
     * Get user's historical orders
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Historical orders
     */
    async getHistoricalOrders(params) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(params.pair || params.symbol);
        const { pair, ...orderParams } = params;
        return this._request('GET', '/fapi/v1/allOrders', { symbol, ...orderParams }, false);
    }

    /**
     * Get notional and leverage brackets
     * @param {string|null} pair - Trading pair (optional)
     * @returns {Promise<Object|Array>} Brackets info
     */
    async getNotionalLeverageBrackets(pair) {
        this.requireAuth();
        const symbol = pair ? this.normalizeSymbol(pair) : null;
        const params = symbol ? { symbol } : {};
        return this._request('GET', '/fapi/v1/leverageBracket', params, false);
    }

    /**
     * Get account configuration
     * @returns {Promise<Object>} Account config
     */
    async getAccountConfig() {
        this.requireAuth();
        return this._request('GET', '/fapi/v1/accountConfig', {}, false);
    }

    /**
     * Get one-time change notional bracket status
     * @returns {Promise<Object>} Bracket status
     */
    async getOneTimeChangeBracketStatus() {
        this.requireAuth();
        return this._request('GET', '/fapi/v1/oneTimeChangeBracket', {}, false);
    }

    /**
     * Request one-time change of notional bracket
     * @param {string} pair - Trading pair
     * @returns {Promise<Object>} Change response
     */
    async requestOneTimeBracketChange(pair) {
        this.requireAuth();
        const symbol = this.normalizeSymbol(pair);
        return this._request('POST', '/fapi/v1/oneTimeChangeBracket', { symbol }, false);
    }
}

module.exports = { Account };
