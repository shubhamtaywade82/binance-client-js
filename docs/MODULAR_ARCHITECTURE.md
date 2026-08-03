# Modular Architecture Documentation

## Overview

The `binance-client-js` SDK has been refactored to follow a modular architecture similar to `dhanhq-ts`, providing:

- **Clean separation of concerns** - Each API category is in its own module
- **Public/Private endpoint distinction** - Public endpoints work without credentials, private endpoints require authentication
- **Mixin pattern** - All modules are combined into a single client class using mixins
- **Full mainnet support** - All Binance USDⓈ-M Futures REST APIs and WebSocket connections

## Architecture

```
src/
├── base.js              # Base class with core HTTP/WebSocket functionality
├── index.js             # Main entry point, combines all modules
├── utils.js             # Utility functions (applyMixins)
└── modules/
    ├── market-data.js   # Public market data endpoints
    ├── trading.js       # Private trading endpoints
    ├── account.js       # Private account management endpoints
    └── websocket.js     # Public & private WebSocket streams
```

## Module Structure

### 1. Base Class (`base.js`)

The `BinanceBase` class provides core functionality:

- HTTP request handling with automatic signing
- WebSocket connection management
- Credential validation
- Symbol normalization
- Error handling

**Key Methods:**
- `hasCredentials()` - Check if API key/secret are configured
- `requireAuth()` - Throw error if credentials missing
- `_request(method, path, data, isPublic)` - Generic HTTP request handler
- `subscribeMarketStream(stream, pair, eventType)` - WebSocket subscription
- `normalizeSymbol(pair)` - Normalize symbol format

### 2. Market Data Module (`modules/market-data.js`)

**All methods are PUBLIC** - No credentials required.

**Available Methods:**
- `getPing()` - Test connectivity
- `getServerTime()` - Get server time
- `getExchangeInfo()` - Get exchange information
- `getOrderBook(pair, limit)` - Get order book depth
- `getTrades(pair, limit)` - Get recent trades
- `getHistoricalTrades(pair, limit, fromId)` - Get historical trades
- `getAggregateTrades(pair, options)` - Get aggregate trades
- `getKlines(pair, interval, options)` - Get candlestick data
- `getContinuousKlines(pair, contractType, interval, options)` - Continuous contract klines
- `getIndexPriceKlines(pair, interval, options)` - Index price klines
- `getMarkPriceKlines(pair, interval, options)` - Mark price klines
- `getTickerPrice(pair)` - Get symbol price
- `getTicker24h(pair)` - Get 24hr ticker statistics
- `getBookTicker(pair)` - Get best bid/ask
- `getTradingDayTicker(pair)` - Get trading day ticker
- `getMarkPrice(pair)` - Get mark price
- `getFundingRateHistory(pair, options)` - Get funding rate history
- `getInstrumentDetails(pair)` - Get instrument details
- `getOpenInterestHistory(pair, period, options)` - Open interest stats
- `getTopLongShortPositionRatio(pair, period, options)` - Trader position ratio
- `getTakerBuySellVolume(pair, period, options)` - Taker volume ratio
- `getGlobalLongShortAccountRatio(pair, period, options)` - Account ratio
- `getTopLongShortAccountRatio(pair, period, options)` - Top trader ratio
- `getBasis(pair, period, options)` - Basis data
- `getAssetIndex(pair)` - Asset index
- `getCompositeIndexInfo(pair)` - Composite index info
- `getOpenInterest(pair)` - Current open interest
- `getFundingInfo()` - Funding info
- `getTickerPriceV2(pair)` - Price ticker v2
- `getBookTickerV2(pair)` - Book ticker v2
- `getBlvtInfo(tokenName)` - BLVT info
- `getIndexPriceConstituents(pair)` - Index constituents
- `getSymbolConfig(pair)` - Symbol configuration
- `getQuantitativeRules()` - Quantitative rules
- `getForceOrders(options)` - Liquidation orders

### 3. Trading Module (`modules/trading.js`)

**All methods REQUIRE authentication** - API Key and Secret required.

**Available Methods:**
- `placeOrder(params)` - Place new order
- `cancelOrder(pair, params)` - Cancel order
- `cancelAllOrders(pair)` - Cancel all open orders
- `queryOrder(pair, params)` - Query order status
- `getOpenOrders(params)` - Get all open orders
- `getAllOrders(params)` - Get all orders (including filled/canceled)
- `modifyOrder(pair, params)` - Modify order
- `placeBatchOrders(orders)` - Place batch orders (up to 5)
- `getUserTrades(params)` - Get trade history
- `getOrderTrades(pair, params)` - Get trades for specific order

### 4. Account Module (`modules/account.js`)

**All methods REQUIRE authentication** - API Key and Secret required.

**Available Methods:**
- `getBalance()` - Get account balance
- `getAccount()` - Get account information
- `getAccountV3()` - Get account info v3
- `getBalanceV3()` - Get balance v3
- `getPositionRisk(pair)` - Get position risk
- `getPositionRiskV3(pair)` - Get position risk v3
- `setLeverage(pair, leverage)` - Set leverage
- `setMarginMode(pair, marginType)` - Set margin mode (ISOLATED/CROSSED)
- `modifyIsolatedMargin(pair, amount, type)` - Modify isolated margin
- `getMarginHistory(params)` - Get margin adjustment history
- `getIncomeHistory(params)` - Get income history
- `getCommissionRates(pair)` - Get commission rates
- `getAdlQuantile(pair)` - Get ADL quantile
- `getForceOrders(params)` - Get force orders
- `getHistoricalOrders(params)` - Get historical orders
- `getNotionalLeverageBrackets(pair)` - Get leverage brackets
- `getAccountConfig()` - Get account config
- `getOneTimeChangeBracketStatus()` - Get bracket change status
- `requestOneTimeBracketChange(pair)` - Request bracket change

### 5. WebSocket Module (`modules/websocket.js`)

**Market data streams are PUBLIC**, **User data streams REQUIRE authentication**.

**Public WebSocket Methods:**
- `subscribeCandles(pair, interval)` - Candlestick stream
- `subscribeOrderBook(pair, depth)` - Order book stream
- `subscribeTrades(pair)` - Trade stream
- `subscribeAllMarketTickers()` - All market tickers
- `subscribeAllBookTickers()` - All book tickers
- `subscribeAllLiquidationOrders()` - All liquidation orders
- `subscribeLiquidationOrder(pair)` - Liquidation order stream
- `subscribeCompositeIndex(pair)` - Composite index stream
- `subscribeAllMarkPrices()` - All mark prices
- `subscribeMarkPrice(pair, speed)` - Mark price stream
- `subscribePremiumIndex(pair)` - Premium index stream
- `subscribeContinuousKlines(pair, contractType, interval)` - Continuous klines
- `subscribeIndexPriceKlines(pair, interval)` - Index price klines
- `subscribeMarkPriceKlines(pair, interval)` - Mark price klines
- `subscribeAllMiniTickers()` - All mini tickers
- `subscribeMiniTicker(pair)` - Mini ticker stream
- `subscribeBookTicker(pair)` - Book ticker stream
- `subscribeOpenInterest(pair, period)` - Open interest stream
- `subscribeCombined(streams)` - Subscribe to multiple streams

**Private WebSocket Methods:**
- `subscribeUserData()` - User data stream (requires auth)

## Usage Examples

### Public Endpoints (No Credentials)

```javascript
const { BinanceFuturesClient } = require('binance-client');

// Create client without credentials
const client = new BinanceFuturesClient();

// All public endpoints work
const ticker = await client.getTickerPrice('BTCUSDT');
console.log('BTC Price:', ticker.price);

const orderBook = await client.getOrderBook('ETHUSDT', 20);
console.log('Order Book:', orderBook);

const klines = await client.getKlines('BTCUSDT', '1h', { limit: 100 });
console.log('Klines:', klines);
```

### Private Endpoints (With Credentials)

```javascript
const { BinanceFuturesClient } = require('binance-client');

// Create client with credentials
const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true // Optional: use testnet
});

// Check if credentials are available
console.log('Has credentials:', client.hasCredentials());

// Private endpoints now work
const account = await client.getAccount();
console.log('Available Balance:', account.availableBalance);

const positions = await client.getPositionRisk();
console.log('Positions:', positions);

// Place an order
const order = await client.placeOrder({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 0.001,
    price: 50000,
    timeInForce: 'GTC'
});
```

### Authentication Enforcement

```javascript
const client = new BinanceFuturesClient();

// This will throw an error
try {
    await client.getAccount();
} catch (error) {
    console.log(error.message); 
    // "API Key and Secret required for this operation"
}

// Public endpoints still work
const ticker = await client.getTickerPrice('BTCUSDT'); // ✓ Works
```

### WebSocket Streams

```javascript
const { BinanceFuturesClient } = require('binance-client');

const client = new BinanceFuturesClient();

// Public market data stream
const ws = client.subscribeCandles('BTCUSDT', '1m');

ws.on('open', () => {
    console.log('Connected!');
});

ws.on('message', (data) => {
    console.log('Candle update:', data);
});

ws.on('error', (err) => {
    console.error('Error:', err);
});

// Close all connections when done
client.closeAllWebSockets();
```

### User Data Stream (Requires Auth)

```javascript
const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET'
});

// Subscribe to user data stream
const ws = await client.subscribeUserData();

ws.on('userData', (data) => {
    console.log('User data update:', data);
});

ws.on(this.wsEvents.accountOrder, (data) => {
    console.log('Order update:', data);
});

ws.on(this.wsEvents.accountPosition, (data) => {
    console.log('Position update:', data);
});
```

## Migration from Old Version

The old monolithic `binance-futures-client.js` file is still available for backward compatibility. However, the new modular structure is recommended:

**Old:**
```javascript
const BinanceFuturesClient = require('./binance-futures-client');
const client = new BinanceFuturesClient({ apiKey, apiSecret });
```

**New:**
```javascript
const { BinanceFuturesClient } = require('./src');
const client = new BinanceFuturesClient({ apiKey, apiSecret });
```

Both work identically, but the new version offers:
- Better code organization
- Easier maintenance
- Clearer separation of public/private endpoints
- Mixin pattern for extensibility

## Error Handling

The SDK provides three custom error classes:

- `BinanceError` - Base error class
- `BinanceAPIError` - API response errors (includes status code, response data)
- `BinanceNetworkError` - Network/connection errors

```javascript
const { BinanceFuturesClient, BinanceAPIError, BinanceNetworkError } = require('./src');

const client = new BinanceFuturesClient();

try {
    await client.getTickerPrice('INVALID_SYMBOL');
} catch (error) {
    if (error instanceof BinanceAPIError) {
        console.log('API Error:', error.status, error.data);
    } else if (error instanceof BinanceNetworkError) {
        console.log('Network Error:', error.originalError);
    } else {
        console.log('Other Error:', error.message);
    }
}
```

## Best Practices

1. **Use environment variables for credentials:**
   ```javascript
   const client = new BinanceFuturesClient({
       apiKey: process.env.BINANCE_API_KEY,
       apiSecret: process.env.BINANCE_API_SECRET
   });
   ```

2. **Check credentials before private operations:**
   ```javascript
   if (!client.hasCredentials()) {
       throw new Error('Credentials required');
   }
   ```

3. **Close WebSocket connections when done:**
   ```javascript
   client.closeAllWebSockets();
   ```

4. **Use testnet for development:**
   ```javascript
   const client = new BinanceFuturesClient({
       apiKey: '...',
       apiSecret: '...',
       testnet: true
   });
   ```

5. **Enable debug mode for troubleshooting:**
   ```javascript
   const client = new BinanceFuturesClient({ debug: true });
   ```
