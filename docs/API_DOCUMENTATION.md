# Binance USDⓈ-M Futures API Documentation

## BinanceFuturesClient

### Constructor

```javascript
const client = new BinanceFuturesClient({
    apiKey: '...',
    apiSecret: '...',
    testnet: true,
    debug: false,
    recvWindow: 5000
});
```

### Market Data Methods

#### `getPing()`
Test connectivity to the Rest API.

#### `getServerTime()`
Check server time.

#### `getExchangeInfo()`
Current exchange trading rules and symbol information.

#### `getOrderBook(symbol, limit)`
Order book depth. `limit` default 100.

#### `getKlines(symbol, interval, options)`
Kline/candlestick bars for a symbol.

#### `getTickerPrice(symbol)`
24 hour rolling window price change statistics.

#### `getMarkPrice(symbol)`
Mark price and funding rate.

#### `getFundingRateHistory(symbol, limit)`
Get funding rate history.

### Account & Trade Methods (Authenticated)

#### `getBalance()`
Get futures account balance.

#### `getAccount()`
Get current account information.

#### `getPositionRisk(symbol)`
Get position risk.

#### `setLeverage(symbol, leverage)`
Change initial leverage.

#### `createOrder(params)`
Place a new order.

#### `getOrder(symbol, orderId, origClientOrderId)`
Check an order's status.

#### `cancelOrder(symbol, orderId, origClientOrderId)`
Cancel an active order.

#### `getOpenOrders(symbol)`
Get all open orders on a symbol.

#### `getAllOrders(symbol, options)`
Get all account orders; active, canceled, or filled.

### WebSocket Methods

#### `subscribeMarketStream(stream)`
Subscribe to a public market stream. Emits events named after the stream.
Example streams: `btcusdt@aggTrade`, `btcusdt@markPrice`, `btcusdt@kline_1m`.

#### `subscribeUserStream()`
Subscribe to the user data stream for account updates. Emits `userData` and specific event types like `ORDER_TRADE_UPDATE`.
Automatically handles `listenKey` creation and renewal.

#### `unsubscribeUserStream()`
Close the user data stream and clean up resources.
