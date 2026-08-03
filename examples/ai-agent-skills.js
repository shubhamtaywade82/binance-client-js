const { BinanceFuturesClient } = require('../binance-futures-client.js');

/**
 * Binance AI Agent Skills Adapter
 * 
 * This adapter wraps the BinanceFuturesClient to expose methods as "skills"
 * that can be used by AI agents, chatbots, or other automated systems.
 * 
 * Skills are organized into logical categories:
 * - usdm_market_data: Price, orderbook, klines, funding rates
 * - usdm_trading: Place, cancel, modify orders
 * - usdm_positions: Manage leverage, margin, position mode
 * - usdm_account: Balance, account info, trade history
 * - usdm_algo_orders: Stop-loss, take-profit, trailing stops
 * - usdm_ws_market: Real-time market data streams
 * - usdm_ws_account: Real-time account updates
 * - usdm_ws_api_trading: Low-latency WebSocket API trading
 */
class BinanceAIAgentSkills {
    /**
     * @param {Object} options - Configuration options
     * @param {string} [options.apiKey=''] - Binance API Key
     * @param {string} [options.apiSecret=''] - Binance API Secret
     * @param {boolean} [options.testnet=false] - Use testnet endpoints
     * @param {boolean} [options.demo=false] - Use demo endpoints
     * @param {boolean} [options.debug=false] - Enable debug logging
     */
    constructor(options = {}) {
        this.client = new BinanceFuturesClient(options);
        this.skills = this._registerSkills();
    }

    /**
     * Register all available skills
     * @private
     */
    _registerSkills() {
        return {
            // Market Data Skills
            'usdm_market_data': {
                description: 'Get USD-M Futures market data',
                methods: {
                    get_price: (symbol) => this.client.getTickerPrice(symbol),
                    get_orderbook: (symbol, limit = 100) => this.client.getOrderBook(symbol, limit),
                    get_klines: (symbol, interval, options = {}) => this.client.getKlines(symbol, interval, options),
                    get_24h_ticker: (symbol) => this.client.getTicker24h(symbol),
                    get_funding_rate: (symbol, limit = 100) => this.client.getFundingRateHistory(symbol, limit),
                    get_mark_price: (symbol) => this.client.getMarkPrice(symbol),
                    get_open_interest: (symbol) => this.client.getOpenInterest(symbol),
                    get_trades: (symbol, limit = 500) => this.client.getTrades(symbol, limit),
                    get_aggregate_trades: (symbol, options = {}) => this.client.getAggregateTrades(symbol, options),
                    get_book_ticker: (symbol) => this.client.getBookTicker(symbol),
                    get_instrument_details: (symbol) => this.client.getInstrumentDetails(symbol)
                }
            },

            // Trading Skills
            'usdm_trading': {
                description: 'Execute USD-M Futures trades',
                methods: {
                    place_order: (params) => this.client.createOrder(params),
                    cancel_order: (symbol, orderId, origClientOrderId) => 
                        this.client.cancelOrder(symbol, orderId, origClientOrderId),
                    modify_order: (params) => this.client.modifyOrder(params),
                    batch_orders: (orders) => this.client.createBatchOrders(orders),
                    cancel_all: (symbol) => this.client.cancelAllOpenOrders(symbol),
                    get_order: (symbol, orderId, origClientOrderId) => 
                        this.client.getOrder(symbol, orderId, origClientOrderId),
                    get_open_orders: (symbol) => this.client.getOpenOrders(symbol),
                    get_all_orders: (symbol, options = {}) => this.client.getAllOrders(symbol, options),
                    test_order: (params) => this.client.createTestOrder(params)
                }
            },

            // Position Management Skills
            'usdm_positions': {
                description: 'Manage USD-M Futures positions',
                methods: {
                    get_position: (symbol) => this.client.getPositionRisk(symbol),
                    set_leverage: (symbol, leverage) => this.client.setLeverage(symbol, leverage),
                    set_margin_type: (symbol, marginType) => this.client.setMarginType(symbol, marginType),
                    modify_margin: (symbol, amount, type) => 
                        this.client.modifyPositionMargin(symbol, amount, type),
                    get_position_mode: () => this.client.getPositionMode(),
                    set_position_mode: (dualSide) => this.client.setPositionMode(dualSide),
                    get_multi_assets_margin: () => this.client.getMultiAssetsMargin(),
                    set_multi_assets_margin: (multiAssetsMargin) => 
                        this.client.setMultiAssetsMargin(multiAssetsMargin),
                    get_adl_quantile: (symbol) => this.client.getAdlQuantile(symbol),
                    get_leverage_brackets: (symbol) => this.client.getLeverageBrackets(symbol),
                    get_position_margin_history: (symbol, options = {}) => 
                        this.client.getPositionMarginHistory(symbol, options)
                }
            },

            // Account Skills
            'usdm_account': {
                description: 'Access USD-M Futures account information',
                methods: {
                    get_balance: () => this.client.getBalance(),
                    get_account: () => this.client.getAccount(),
                    get_account_v3: () => this.client.getAccountV3(),
                    get_balance_v3: () => this.client.getBalanceV3(),
                    get_trades: (symbol, options = {}) => this.client.getUserTrades(symbol, options),
                    get_income_history: (options = {}) => this.client.getIncomeHistory(options),
                    get_commission_rate: (symbol) => this.client.getUserCommissionRate(symbol),
                    get_fee_burn_status: () => this.client.getFeeBurnStatus(),
                    set_fee_burn_status: (feeBurn) => this.client.setFeeBurnStatus(feeBurn),
                    get_api_trading_status: () => this.client.getApiTradingStatus(),
                    get_rate_limit: () => this.client.getRateLimitOrder()
                }
            },

            // Advanced Order Skills (Algo Orders)
            'usdm_algo_orders': {
                description: 'Manage USD-M algorithmic/conditional orders',
                methods: {
                    place_algo_order: (params) => this.client.createAlgoOrder(params),
                    cancel_algo_order: (symbol, algoId, clientAlgoId) => 
                        this.client.cancelAlgoOrder(symbol, algoId, clientAlgoId),
                    cancel_all_algo_orders: (symbol) => this.client.cancelAllOpenAlgoOrders(symbol),
                    get_algo_order: (symbol, algoId, clientAlgoId) => 
                        this.client.getAlgoOrder(symbol, algoId, clientAlgoId),
                    get_open_algo_orders: (symbol) => this.client.getOpenAlgoOrders(symbol),
                    get_all_algo_orders: (symbol, options = {}) => 
                        this.client.getAllAlgoOrders(symbol, options)
                }
            },

            // WebSocket Market Data Skills
            'usdm_ws_market': {
                description: 'Subscribe to USD-M real-time market streams',
                methods: {
                    subscribe_candles: (symbol, interval = '1m') => 
                        this.client.wsSubscribeCandles(symbol, interval),
                    subscribe_trades: (symbol) => this.client.wsSubscribeTrades(symbol),
                    subscribe_orderbook: (symbol, depth = 20) => 
                        this.client.wsSubscribeOrderBook(symbol, depth),
                    subscribe_mark_price: (symbol, speed = '1s') => 
                        this.client.wsSubscribeMarkPrice(symbol, speed),
                    subscribe_all_tickers: () => this.client.wsSubscribeAllMarketTickers(),
                    subscribe_all_book_tickers: () => this.client.wsSubscribeAllBookTickers(),
                    subscribe_mini_ticker: (symbol) => this.client.wsSubscribeMiniTicker(symbol),
                    subscribe_all_mini_tickers: () => this.client.wsSubscribeAllMiniTickers(),
                    subscribe_liquidation_order: (symbol) => 
                        this.client.wsSubscribeLiquidationOrder(symbol),
                    subscribe_all_liquidation_orders: () => 
                        this.client.wsSubscribeAllLiquidationOrders(),
                    subscribe_composite_index: (symbol) => 
                        this.client.wsSubscribeCompositeIndex(symbol),
                    subscribe_all_mark_prices: () => this.client.wsSubscribeAllMarkPrices(),
                    subscribe_rolling_window_ticker: (symbol, window = '1h') => 
                        this.client.wsSubscribeRollingWindowTicker(symbol, window),
                    subscribe_continuous_candles: (symbol, contractType, interval = '1m') => 
                        this.client.wsSubscribeContinuousCandles(symbol, contractType, interval),
                    subscribe_index_price_candles: (symbol, interval = '1m') => 
                        this.client.wsSubscribeIndexPriceCandles(symbol, interval),
                    subscribe_mark_price_candles: (symbol, interval = '1m') => 
                        this.client.wsSubscribeMarkPriceCandles(symbol, interval),
                    subscribe_combined_streams: (streams) => 
                        this.client.subscribeCombinedMarketStreams(streams)
                }
            },

            // WebSocket Account Skills
            'usdm_ws_account': {
                description: 'Subscribe to USD-M account updates',
                methods: {
                    subscribe_user_stream: () => this.client.subscribeUserStream(),
                    close_user_stream: () => this.client.closeUserStream()
                }
            },

            // WebSocket API Trading Skills (Low-latency)
            'usdm_ws_api_trading': {
                description: 'Execute trades via WebSocket API for lower latency',
                methods: {
                    ws_place_order: (params) => this.client.wsApiCreateOrder(params),
                    ws_cancel_order: (params) => this.client.wsApiCancelOrder(params),
                    ws_modify_order: (params) => this.client.wsApiModifyOrder(params),
                    ws_place_algo_order: (params) => this.client.wsApiCreateAlgoOrder(params),
                    ws_cancel_algo_order: (params) => this.client.wsApiCancelAlgoOrder(params)
                }
            },

            // Utility Skills
            'usdm_utilities': {
                description: 'Utility and administrative functions',
                methods: {
                    get_server_time: () => this.client.getServerTime(),
                    ping: () => this.client.getPing(),
                    get_exchange_info: () => this.client.getExchangeInfo(),
                    get_funding_info: () => this.client.getFundingInfo(),
                    get_force_orders: (options = {}) => this.client.getForceOrders(options),
                    get_delist_schedule: (symbol) => this.client.getDelistSchedule(symbol),
                    set_countdown_cancel_all: (symbol, countdownTime) => 
                        this.client.setCountdownCancelAll(symbol, countdownTime),
                    close_all_websockets: () => this.client.closeAllWebSockets()
                }
            }
        };
    }

    /**
     * Execute a skill method
     * @param {string} skillName - Name of the skill (e.g., 'usdm_trading')
     * @param {string} methodName - Method to call (e.g., 'place_order')
     * @param {...any} args - Arguments to pass to the method
     * @returns {Promise<any>} Result of the skill execution
     * @throws {Error} If skill or method not found
     */
    async executeSkill(skillName, methodName, ...args) {
        const skill = this.skills[skillName];
        if (!skill) {
            throw new Error(`Skill '${skillName}' not found. Available skills: ${Object.keys(this.skills).join(', ')}`);
        }
        
        const method = skill.methods[methodName];
        if (!method) {
            throw new Error(`Method '${methodName}' not found in skill '${skillName}'. Available methods: ${Object.keys(skill.methods).join(', ')}`);
        }
        
        return await method(...args);
    }

    /**
     * List all available skills
     * @returns {Array<{name: string, description: string, methods: string[]}>}
     */
    listSkills() {
        return Object.entries(this.skills).map(([name, skill]) => ({
            name,
            description: skill.description,
            methods: Object.keys(skill.methods)
        }));
    }

    /**
     * Get details of a specific skill
     * @param {string} skillName - Name of the skill
     * @returns {{name: string, description: string, methods: string[]}}
     * @throws {Error} If skill not found
     */
    getSkillDetails(skillName) {
        const skill = this.skills[skillName];
        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }
        return {
            name: skillName,
            description: skill.description,
            methods: Object.keys(skill.methods)
        };
    }

    /**
     * Check if a skill exists
     * @param {string} skillName - Name of the skill
     * @returns {boolean}
     */
    hasSkill(skillName) {
        return !!this.skills[skillName];
    }

    /**
     * Check if a method exists in a skill
     * @param {string} skillName - Name of the skill
     * @param {string} methodName - Name of the method
     * @returns {boolean}
     */
    hasMethod(skillName, methodName) {
        const skill = this.skills[skillName];
        return skill ? !!skill.methods[methodName] : false;
    }

    /**
     * Get the underlying BinanceFuturesClient instance
     * @returns {BinanceFuturesClient}
     */
    getClient() {
        return this.client;
    }
}

module.exports = { BinanceAIAgentSkills };
