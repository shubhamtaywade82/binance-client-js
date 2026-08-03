# Binance AI Agent Skills Integration Guide

This document explains how the `binance-client-js` SDK relates to Binance AI Agent Skills and how to use them together.

## Understanding Binance AI Agent Skills

Binance AI Agent Skills are pre-built capabilities that enable AI assistants to interact with Binance services. The Skills Hub includes:

### USD-M Futures Skills Coverage

Your `binance-client-js` SDK already implements **all core USD-M Futures operations** that correspond to Binance AI Agent Skills:

| AI Agent Skill Category | SDK Methods | Description |
|------------------------|-------------|-------------|
| **Market Data** | `getTickerPrice()`, `getOrderBook()`, `getKlines()`, `getTrades()` | Real-time and historical market data |
| **Trading Operations** | `createOrder()`, `cancelOrder()`, `modifyOrder()`, `createBatchOrders()` | Place, cancel, and modify orders |
| **Position Management** | `getPositionRisk()`, `setLeverage()`, `modifyPositionMargin()`, `setMarginType()` | Manage open positions |
| **Account Management** | `getAccount()`, `getBalance()`, `getUserTrades()`, `getIncomeHistory()` | Account information and history |
| **Advanced Orders** | `createAlgoOrder()`, `cancelAlgoOrder()`, `getOpenAlgoOrders()` | Stop-loss, take-profit, trailing stops |
| **WebSocket Streams** | `wsSubscribeCandles()`, `wsSubscribeTrades()`, `subscribeUserStream()` | Real-time market and account updates |
| **WebSocket API Trading** | `wsApiCreateOrder()`, `wsApiCancelOrder()`, `wsApiModifyOrder()` | Low-latency trading via WebSocket |

## Option 1: Using the SDK Directly (Recommended)

The SDK provides native JavaScript methods for all USD-M Futures operations:

```javascript
const { BinanceFuturesClient } = require('binance-client-js');

const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true
});

async function tradeWithSkills() {
    // Market Data Skill
    const ticker = await client.getTickerPrice('BTCUSDT');
    
    // Trading Skill
    const order = await client.createOrder({
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.1,
        price: 3000,
        timeInForce: 'GTC'
    });
    
    // Position Management Skill
    await client.setLeverage('BTCUSDT', 10);
    const position = await client.getPositionRisk('BTCUSDT');
    
    // Account Information Skill
    const account = await client.getAccount();
    
    // WebSocket Market Data Skill
    client.wsSubscribeCandles('BTCUSDT', '1m');
    client.on('ws:candlestick', (candle) => {
        console.log(`New candle: ${candle.close}`);
    });
}
```

## Option 2: Creating an AI Agent Skills Adapter

If you want to expose the SDK as formal "skills" for an AI agent framework, create an adapter:

```javascript
// ai-agent-skills.js
const { BinanceFuturesClient } = require('binance-client-js');

class BinanceAIAgentSkills {
    constructor(options = {}) {
        this.client = new BinanceFuturesClient(options);
        this.skills = this._registerSkills();
    }

    _registerSkills() {
        return {
            // Market Data Skills
            'usdm_market_data': {
                description: 'Get USD-M Futures market data',
                methods: {
                    get_price: (symbol) => this.client.getTickerPrice(symbol),
                    get_orderbook: (symbol, limit) => this.client.getOrderBook(symbol, limit),
                    get_klines: (symbol, interval, options) => this.client.getKlines(symbol, interval, options),
                    get_24h_ticker: (symbol) => this.client.getTicker24h(symbol),
                    get_funding_rate: (symbol, limit) => this.client.getFundingRateHistory(symbol, limit)
                }
            },

            // Trading Skills
            'usdm_trading': {
                description: 'Execute USD-M Futures trades',
                methods: {
                    place_order: (params) => this.client.createOrder(params),
                    cancel_order: (symbol, orderId) => this.client.cancelOrder(symbol, orderId),
                    modify_order: (params) => this.client.modifyOrder(params),
                    batch_orders: (orders) => this.client.createBatchOrders(orders),
                    cancel_all: (symbol) => this.client.cancelAllOpenOrders(symbol)
                }
            },

            // Position Management Skills
            'usdm_positions': {
                description: 'Manage USD-M Futures positions',
                methods: {
                    get_position: (symbol) => this.client.getPositionRisk(symbol),
                    set_leverage: (symbol, leverage) => this.client.setLeverage(symbol, leverage),
                    set_margin_type: (symbol, marginType) => this.client.setMarginType(symbol, marginType),
                    modify_margin: (symbol, amount, type) => this.client.modifyPositionMargin(symbol, amount, type),
                    get_position_mode: () => this.client.getPositionMode(),
                    set_position_mode: (dualSide) => this.client.setPositionMode(dualSide)
                }
            },

            // Account Skills
            'usdm_account': {
                description: 'Access USD-M Futures account information',
                methods: {
                    get_balance: () => this.client.getBalance(),
                    get_account: () => this.client.getAccount(),
                    get_trades: (symbol, options) => this.client.getUserTrades(symbol, options),
                    get_income_history: (options) => this.client.getIncomeHistory(options),
                    get_commission_rate: (symbol) => this.client.getUserCommissionRate(symbol)
                }
            },

            // Advanced Order Skills (Algo Orders)
            'usdm_algo_orders': {
                description: 'Manage USD-M algorithmic/conditional orders',
                methods: {
                    place_algo_order: (params) => this.client.createAlgoOrder(params),
                    cancel_algo_order: (symbol, algoId, clientAlgoId) => this.client.cancelAlgoOrder(symbol, algoId, clientAlgoId),
                    get_algo_order: (symbol, algoId, clientAlgoId) => this.client.getAlgoOrder(symbol, algoId, clientAlgoId),
                    get_open_algo_orders: (symbol) => this.client.getOpenAlgoOrders(symbol)
                }
            },

            // WebSocket Market Data Skills
            'usdm_ws_market': {
                description: 'Subscribe to USD-M real-time market streams',
                methods: {
                    subscribe_candles: (symbol, interval) => this.client.wsSubscribeCandles(symbol, interval),
                    subscribe_trades: (symbol) => this.client.wsSubscribeTrades(symbol),
                    subscribe_orderbook: (symbol, depth) => this.client.wsSubscribeOrderBook(symbol, depth),
                    subscribe_mark_price: (symbol, speed) => this.client.wsSubscribeMarkPrice(symbol, speed),
                    subscribe_all_tickers: () => this.client.wsSubscribeAllMarketTickers()
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
            }
        };
    }

    /**
     * Execute a skill method
     * @param {string} skillName - Name of the skill (e.g., 'usdm_trading')
     * @param {string} methodName - Method to call (e.g., 'place_order')
     * @param {Array} args - Arguments to pass
     */
    async executeSkill(skillName, methodName, ...args) {
        const skill = this.skills[skillName];
        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }
        
        const method = skill.methods[methodName];
        if (!method) {
            throw new Error(`Method '${methodName}' not found in skill '${skillName}'`);
        }
        
        return await method(...args);
    }

    /**
     * List all available skills
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
}

module.exports = { BinanceAIAgentSkills };
```

### Usage Example with Skills Adapter

```javascript
const { BinanceAIAgentSkills } = require('./ai-agent-skills');

const agent = new BinanceAIAgentSkills({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true
});

async function demonstrateSkills() {
    // List all available skills
    console.log('Available Skills:', agent.listSkills());
    
    // Execute Market Data Skill
    const price = await agent.executeSkill('usdm_market_data', 'get_price', 'BTCUSDT');
    console.log('BTC Price:', price);
    
    // Execute Trading Skill
    const order = await agent.executeSkill('usdm_trading', 'place_order', {
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.1,
        price: 3000,
        timeInForce: 'GTC'
    });
    
    // Execute Position Management Skill
    await agent.executeSkill('usdm_positions', 'set_leverage', 'BTCUSDT', 10);
    
    // Subscribe to WebSocket Market Data
    agent.executeSkill('usdm_ws_market', 'subscribe_candles', 'BTCUSDT', '1m');
    agent.client.on('ws:candlestick', (candle) => {
        console.log('Candle Update:', candle);
    });
}
```

## Complete Skills Reference

### USD-M Market Data Skills

```javascript
// Get current price
await agent.executeSkill('usdm_market_data', 'get_price', 'BTCUSDT');

// Get order book depth
await agent.executeSkill('usdm_market_data', 'get_orderbook', 'BTCUSDT', 100);

// Get klines/candlesticks
await agent.executeSkill('usdm_market_data', 'get_klines', 'BTCUSDT', '1h', { limit: 100 });

// Get 24h ticker statistics
await agent.executeSkill('usdm_market_data', 'get_24h_ticker', 'BTCUSDT');

// Get funding rate history
await agent.executeSkill('usdm_market_data', 'get_funding_rate', 'BTCUSDT', 100);
```

### USD-M Trading Skills

```javascript
// Place a market order
await agent.executeSkill('usdm_trading', 'place_order', {
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.001
});

// Place a limit order
await agent.executeSkill('usdm_trading', 'place_order', {
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: 'LIMIT',
    quantity: 0.001,
    price: 50000,
    timeInForce: 'GTC'
});

// Cancel an order
await agent.executeSkill('usdm_trading', 'cancel_order', 'BTCUSDT', 12345678);

// Modify an order
await agent.executeSkill('usdm_trading', 'modify_order', {
    symbol: 'BTCUSDT',
    orderId: 12345678,
    quantity: 0.002,
    price: 51000
});

// Batch place orders
await agent.executeSkill('usdm_trading', 'batch_orders', [
    { symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 0.001 },
    { symbol: 'ETHUSDT', side: 'BUY', type: 'MARKET', quantity: 0.01 }
]);
```

### USD-M Position Management Skills

```javascript
// Get position risk
const position = await agent.executeSkill('usdm_positions', 'get_position', 'BTCUSDT');

// Set leverage
await agent.executeSkill('usdm_positions', 'set_leverage', 'BTCUSDT', 20);

// Change margin type
await agent.executeSkill('usdm_positions', 'set_margin_type', 'BTCUSDT', 'ISOLATED');

// Add isolated margin
await agent.executeSkill('usdm_positions', 'modify_margin', 'BTCUSDT', 100, 1);

// Check position mode
const mode = await agent.executeSkill('usdm_positions', 'get_position_mode');

// Set hedge mode
await agent.executeSkill('usdm_positions', 'set_position_mode', true);
```

### USD-M Account Skills

```javascript
// Get account balance
const balance = await agent.executeSkill('usdm_account', 'get_balance');

// Get full account info
const account = await agent.executeSkill('usdm_account', 'get_account');

// Get trade history
const trades = await agent.executeSkill('usdm_account', 'get_trades', 'BTCUSDT', { limit: 50 });

// Get income history (funding fees, liquidations, etc.)
const income = await agent.executeSkill('usdm_account', 'get_income_history', { 
    incomeType: 'FUNDING_FEE',
    startTime: Date.now() - 86400000 
});

// Get commission rate
const rate = await agent.executeSkill('usdm_account', 'get_commission_rate', 'BTCUSDT');
```

### USD-M Algo Order Skills

```javascript
// Place a stop-loss order
await agent.executeSkill('usdm_algo_orders', 'place_algo_order', {
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: 'STOP_LOSS',
    quantity: 0.001,
    stopPrice: 48000,
    workingType: 'MARK_PRICE'
});

// Place a take-profit order
await agent.executeSkill('usdm_algo_orders', 'place_algo_order', {
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: 'TAKE_PROFIT',
    quantity: 0.001,
    stopPrice: 55000,
    workingType: 'MARK_PRICE'
});

// Cancel an algo order
await agent.executeSkill('usdm_algo_orders', 'cancel_algo_order', 'BTCUSDT', 987654321);

// Get open algo orders
const openAlgos = await agent.executeSkill('usdm_algo_orders', 'get_open_algo_orders', 'BTCUSDT');
```

### WebSocket Market Data Skills

```javascript
// Subscribe to candlestick updates
agent.executeSkill('usdm_ws_market', 'subscribe_candles', 'BTCUSDT', '5m');
agent.client.on('ws:candlestick', (candle) => {
    console.log(`Candle: ${candle.open} -> ${candle.close}`);
});

// Subscribe to trade updates
agent.executeSkill('usdm_ws_market', 'subscribe_trades', 'BTCUSDT');
agent.client.on('ws:new-trade', (trade) => {
    console.log(`Trade: ${trade.price} x ${trade.quantity}`);
});

// Subscribe to order book updates
agent.executeSkill('usdm_ws_market', 'subscribe_orderbook', 'BTCUSDT', 20);
agent.client.on('ws:depth-snapshot', (book) => {
    console.log(`Best bid: ${book.bids[0].price}, Best ask: ${book.asks[0].price}`);
});

// Subscribe to mark price updates
agent.executeSkill('usdm_ws_market', 'subscribe_mark_price', 'BTCUSDT', '1s');
agent.client.on('ws:markPrice', (data) => {
    console.log(`Mark Price: ${data.markPrice}, Funding Rate: ${data.fundingRate}`);
});

// Subscribe to all tickers
agent.executeSkill('usdm_ws_market', 'subscribe_all_tickers');
agent.client.on('ws:allMarketTickers', (tickers) => {
    tickers.forEach(t => console.log(`${t.symbol}: ${t.lastPrice}`));
});
```

### WebSocket Account Skills

```javascript
// Subscribe to user data stream (order fills, position updates, balance changes)
await agent.executeSkill('usdm_ws_account', 'subscribe_user_stream');

agent.client.on('ws:df-order-update', (orderUpdate) => {
    console.log('Order Update:', orderUpdate);
});

agent.client.on('ws:balance-update', (balanceUpdate) => {
    console.log('Balance Update:', balanceUpdate);
});

agent.client.on('ws:df-position-update', (positionUpdate) => {
    console.log('Position Update:', positionUpdate);
});

// Close user stream when done
await agent.executeSkill('usdm_ws_account', 'close_user_stream');
```

### WebSocket API Trading Skills (Ultra Low Latency)

```javascript
// Place order via WebSocket API (faster than REST)
const wsOrder = await agent.executeSkill('usdm_ws_api_trading', 'ws_place_order', {
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 0.001,
    price: 50000,
    timeInForce: 'GTC'
});

// Cancel order via WebSocket API
const wsCancel = await agent.executeSkill('usdm_ws_api_trading', 'ws_cancel_order', {
    symbol: 'BTCUSDT',
    orderId: 12345678
});

// Modify order via WebSocket API
const wsModify = await agent.executeSkill('usdm_ws_api_trading', 'ws_modify_order', {
    symbol: 'BTCUSDT',
    orderId: 12345678,
    quantity: 0.002,
    price: 51000
});

// Place algo order via WebSocket API
const wsAlgo = await agent.executeSkill('usdm_ws_api_trading', 'ws_place_algo_order', {
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: 'STOP_LOSS',
    quantity: 0.001,
    stopPrice: 48000
});
```

## Integration with AI Agent Frameworks

To integrate with a custom AI agent or chatbot framework:

```javascript
// Example: Simple AI command parser
async function handleAICommand(command, params) {
    const agent = new BinanceAIAgentSkills({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
        testnet: true
    });

    const commandMap = {
        'buy': { skill: 'usdm_trading', method: 'place_order' },
        'sell': { skill: 'usdm_trading', method: 'place_order' },
        'cancel': { skill: 'usdm_trading', method: 'cancel_order' },
        'position': { skill: 'usdm_positions', method: 'get_position' },
        'balance': { skill: 'usdm_account', method: 'get_balance' },
        'price': { skill: 'usdm_market_data', method: 'get_price' },
        'leverage': { skill: 'usdm_positions', method: 'set_leverage' }
    };

    const mapping = commandMap[command.toLowerCase()];
    if (!mapping) {
        throw new Error(`Unknown command: ${command}`);
    }

    return await agent.executeSkill(mapping.skill, mapping.method, params);
}

// Usage examples:
// await handleAICommand('price', 'BTCUSDT');
// await handleAICommand('buy', { symbol: 'BTCUSDT', type: 'MARKET', quantity: 0.001 });
// await handleAICommand('leverage', 'BTCUSDT', 20);
```

## Security Best Practices

1. **Use Testnet First**: Always test your skills on Binance testnet before using real funds
2. **Environment Variables**: Store API keys in `.env` files, never in code
3. **Minimal Permissions**: Create API keys with only required permissions
4. **IP Whitelisting**: Restrict API key access to specific IP addresses
5. **Error Handling**: Implement proper error handling for all skill executions

```javascript
// .env.example
BINANCE_API_KEY=your_testnet_api_key
BINANCE_API_SECRET=your_testnet_api_secret
BINANCE_TESTNET=true
```

## Conclusion

The `binance-client-js` SDK provides complete coverage of all USD-M Futures AI Agent Skills. You can:

1. **Use the SDK directly** for traditional application development
2. **Use the Skills Adapter** to expose methods in an AI-agent-friendly format
3. **Combine both approaches** for maximum flexibility

All skills support production, testnet, and demo environments through the `testnet` and `demo` constructor options.
