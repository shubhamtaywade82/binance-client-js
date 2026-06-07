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

#### `getTime()`
Check server time.

#### `getExchangeInfo()`
Current exchange trading rules and symbol information.

#### `getOrderBook(symbol, limit)`
Order book depth. `limit` default 100.

#### `getRecentTrades(symbol, limit)`
Get recent market trades.

#### `getKlines(symbol, interval, options)`
Kline/candlestick bars for a symbol.

#### `getTickerPrice(symbol)`
24 hour rolling window price change statistics.

#### `getOpenInterest(symbol)`
Get present open interest of a specific symbol.

#### `getFundingRate(symbol, limit)`
Get funding rate history.

#### `getMarkPrice(symbol)`
Mark price and funding rate.

### Account & Trade Methods (Signed)

#### `getAccount()`
Get current account information.

#### `getBalance()`
Get futures account balance.

#### `getPositionRisk(symbol)`
Get position risk.

#### `createOrder(params)`
Place a new order.
`params` example: `{ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.001, price: 60000, timeInForce: 'GTC' }`

#### `cancelOrder(symbol, orderId, origClientOrderId)`
Cancel an active order.

#### `getOrder(symbol, orderId, origClientOrderId)`
Check an order's status.

#### `getOpenOrders(symbol)`
Get all open orders on a symbol.

#### `getAllOrders(symbol, options)`
Get all account orders; active, canceled, or filled.

### WebSocket Methods

#### `subscribeMarketStream(stream, callback)`
Subscribe to a market data stream.
Example streams: `btcusdt@aggTrade`, `btcusdt@kline_1m`, `btcusdt@depth20`.

#### `subscribeUserStream(callback)`
Subscribe to user data stream for account updates (orders, balance, etc.).
Automatically handles `listenKey` creation and keep-alive.
