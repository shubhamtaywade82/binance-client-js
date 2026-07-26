# Binance USDⓈ-M Futures API Documentation

## BinanceFuturesClient

### Constructor

```javascript
const { BinanceFuturesClient } = require('binance-client-js');

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

#### `getTrades(symbol, limit)`
Get recent market trades.

#### `getHistoricalTrades(symbol, limit, fromId)`
Get older market trades.

#### `getAggregateTrades(symbol, options)`
Get aggregate trades.

#### `getKlines(symbol, interval, options)`
Standard kline data.

#### `getContinuousKlines(symbol, contractType, interval, options)`
Continuous contract kline data.

#### `getIndexPriceKlines(symbol, interval, options)`
Index price kline data.

#### `getMarkPriceKlines(symbol, interval, options)`
Mark price kline data.

#### `getTickerPrice(symbol)`
Latest price for a symbol.

#### `getTicker24h(symbol)`
24 hour rolling window price change statistics.

#### `getBookTicker(symbol)`
Best price/qty on the order book.

#### `getTradingDayTicker(symbol)`
Price change statistics for the trading day.

#### `getMarkPrice(symbol)`
Mark price and funding rate.

#### `getFundingRateHistory(symbol, limit)`
Get funding rate history.

#### `getOpenInterestHistory(symbol, period, options)`
Get historical open interest data. `period` can be "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d".

#### `getTopLongShortPositionRatio(symbol, period, options)`
Top Long/Short Position Ratio.

#### `getTopLongShortAccountRatio(symbol, period, options)`
Top Long/Short Account Ratio.

#### `getGlobalLongShortAccountRatio(symbol, period, options)`
Global Long/Short Account Ratio.

#### `getTakerBuySellVolume(symbol, period, options)`
Taker Buy/Sell Volume.

#### `getBasis(symbol, period, options)`
Spread between futures and index prices.

#### `getAssetIndex(symbol)`
Real-time price and info for assets in Multi-Assets Mode.

#### `getCompositeIndexInfo(symbol)`
Composite Index Info.

#### `getAdlQuantile(symbol)`
Auto-Deleveraging risk levels.

#### `getBlvtInfo(tokenName)`
Binance Leveraged Tokens info.

#### `getIndexPriceConstituents(symbol)`
Index Price Constituents.

#### `getSymbolConfig(symbol)`
Symbol configuration info.

#### `getQuantitativeRules()`
Quantitative trading rules.

#### `getForceOrders(options)`
Historical liquidation orders.

#### `getInsuranceFundBalance(options)`
Insurance fund balance history.

#### `getPmExchangeInfo()`
Portfolio Margin exchange info.

#### `getDelistSchedule(symbol)`
Delisting schedule info.

#### `requestOrderDownload(options)`
Request asynchronous order history download.

#### `getOrderDownloadStatus(downloadId)`
Get status of order download request.

#### `requestTradeDownload(options)`
Request asynchronous trade history download.

#### `getTradeDownloadStatus(downloadId)`
Get status of trade download request.

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
Place a new order. `params` can include `pair` or `symbol`.

#### `modifyOrder(params)`
Modify an existing order.

#### `createBatchOrders(batchOrders)`
Place multiple orders in a single call.

#### `modifyBatchOrders(batchOrders)`
Modify multiple orders in a single call.

#### `getOrder(symbol, orderId, origClientOrderId)`
Check an order's status.

#### `cancelOrder(symbol, orderId, origClientOrderId)`
Cancel an active order.

#### `cancelBatchOrders(symbol, orderIdList, origClientOrderIdList)`
Cancel multiple orders in a single call.

#### `getOpenOrders(symbol)`
Get all open orders on a symbol.

#### `getAllOrders(symbol, options)`
Get all account orders; active, canceled, or filled.

#### `cancelAllOpenOrders(symbol)`
Cancel all open orders on a symbol.

#### `getUserTrades(symbol, options)`
Get account trade history.

#### `getIncomeHistory(options)`
Get account income history (funding, liquidations, etc.).

#### `getLeverageBrackets(symbol)`
Get leverage brackets for a symbol.

#### `getApiTradingStatus()`
Get user's API trading status.

#### `getPositionMarginHistory(symbol, options)`
Get history of isolated margin changes.

#### `getRateLimitOrder()`
Get user's current order rate limit usage.

#### `setCountdownCancelAll(symbol, countdownTime)`
Set auto-cancel all orders timer (Heartbeat).

#### `getPositionMode()`
Check if user is in Hedge or One-way position mode.

#### `setPositionMode(dualSidePosition)`
Set position mode. `true` for Hedge mode, `false` for One-way mode.

#### `setMarginType(symbol, marginType)`
Set margin type: `ISOLATED` or `CROSSED`.

#### `modifyPositionMargin(symbol, amount, type)`
Modify isolated position margin. `type`: 1 for Add, 2 for Remove.

#### `getMultiAssetsMargin()`
Check if user is in Multi-Asset margin mode.

#### `setMultiAssetsMargin(multiAssetsMargin)`
Set Multi-Asset margin mode.

#### `getUserCommissionRate(symbol)`
Get user's specific commission rate for a symbol.

#### `getFeeBurnStatus()`
Check if BNB fee burn is enabled.

#### `setFeeBurnStatus(feeBurn)`
Enable or disable BNB fee burn.

### WebSocket Methods

#### `wsSubscribeCandles(pair, interval)`
Normalized candle stream. Event: `ws:candlestick`.

#### `wsSubscribeOrderBook(pair, depth)`
Normalized depth stream. Event: `ws:depth-snapshot`.

#### `wsSubscribeTrades(pair)`
Normalized trade stream. Event: `ws:new-trade`.

#### `wsSubscribeMarkPrice(pair, speed)`
Mark Price updates. `speed`: "1s" or "3s". Event: `ws:markPrice`.

#### `wsSubscribeContinuousCandles(pair, contractType, interval)`
Continuous contract candle stream. Event: `ws:candlestick`.

#### `wsSubscribeIndexPriceCandles(pair, interval)`
Index Price candle stream. Event: `ws:candlestick`.

#### `wsSubscribeMarkPriceCandles(pair, interval)`
Mark Price candle stream. Event: `ws:candlestick`.

#### `wsSubscribeMiniTicker(pair)`
Individual symbol mini-ticker updates. Event: `ws:miniTicker`.

#### `wsSubscribeAllMiniTickers()`
All symbols mini-ticker updates. Event: `ws:allMiniTickers`.

#### `wsSubscribeAllMarketTickers()`
All Market Tickers updates. Event: `ws:allMarketTickers`.

#### `wsSubscribeAllBookTickers()`
All Book Tickers updates. Event: `ws:allBookTickers`.

#### `wsSubscribeLiquidationOrder(pair)`
Individual symbol force order updates. Event: `ws:liquidationOrder`.

#### `wsSubscribeAllLiquidationOrders()`
Market-wide Liquidation Orders. Event: `ws:allLiquidationOrders`.

#### `wsSubscribeCompositeIndex(pair)`
Composite Index Price updates. Event: `ws:compositeIndex`.

#### `wsSubscribeAllMarkPrices()`
All symbols Mark Price updates. Event: `ws:allMarkPrices`.

#### `wsSubscribeAllAssetIndices()`
All assets Index Price updates (Multi-Assets Mode). Event: `ws:allAssetIndices`.

#### `wsSubscribeAssetIndex(asset)`
Individual asset Index Price updates. Event: `ws:assetIndex`.

#### `wsSubscribeRollingWindowTicker(pair, window)`
Rolling window (e.g. "1h", "4h") ticker updates. Event: `ws:rollingWindowTicker`.

#### `subscribeUserStream()`
Subscribe to the user data stream for account updates. Emits `ws:df-order-update`, `ws:balance-update`, etc.
Automatically handles `listenKey` creation and renewal.

## Error Classes

The library exports several custom error classes for better error handling:

- **`BinanceError`**: Base class for all library errors.
- **`BinanceAPIError`**: Thrown when the Binance API returns a non-200 response. Includes `status`, `data` (API error msg), `method`, and `url`.
- **`BinanceNetworkError`**: Thrown for network-level issues (timeout, DNS, etc.). Includes the `originalError`.

```javascript
const { BinanceAPIError } = require('binance-client-js');
try {
    await client.createOrder({...});
} catch (err) {
    if (err instanceof BinanceAPIError) {
        console.log(`Binance Error ${err.data.code}: ${err.data.msg}`);
    }
}
```

## Static Utilities

Accessible via the `BinanceFuturesClient` class:

- **`BinanceFuturesClient.nowSeconds()`**: Returns current timestamp in seconds.
- **`BinanceFuturesClient.buildPair(base, target)`**: Builds a standard pair string (e.g., `B-BTC_USDT`).
- **`BinanceFuturesClient.parsePair(pair)`**: Parses a pair string into components.
- **`BinanceFuturesClient.calculateLiquidationPrice(entry, leverage, side)`**: Calculates estimated liquidation price for Isolated Margin.

## Current USDⓈ-M Futures additions

The client tracks the current Binance USDⓈ-M Futures split between REST, market-stream WebSockets, and the authenticated WebSocket API:

- Production REST: `https://fapi.binance.com`
- Demo/testnet REST: `https://demo-fapi.binance.com`
- Production market streams: `wss://fstream.binance.com/ws`
- Demo/testnet market streams: `wss://demo-fstream.binance.com/ws`
- Production WebSocket API: `wss://ws-fapi.binance.com/ws-fapi/v1`
- Demo/testnet WebSocket API: `wss://demo-fapi.binance.com/ws-fapi/v1`

### Constructor URL overrides

```js
const client = new BinanceFuturesClient({
  testnet: true,
  // Optional explicit overrides for private gateways, proxies, or MCP adapters.
  apiBase: 'https://demo-fapi.binance.com',
  wsBase: 'wss://demo-fstream.binance.com/ws',
  wsApiBase: 'wss://demo-fapi.binance.com/ws-fapi/v1'
});
```

### REST market data helpers

- `getOpenInterest(symbol)` calls `GET /fapi/v1/openInterest`.
- `getFundingInfo()` calls `GET /fapi/v1/fundingInfo`.
- `getTickerPriceV2(symbol?)` calls `GET /fapi/v2/ticker/price`.
- `getBookTickerV2(symbol?)` calls `GET /fapi/v2/ticker/bookTicker`.

### Algo conditional orders

Binance is migrating USDⓈ-M conditional orders to Algo Service endpoints. Use these helpers for stop-loss, take-profit, and trailing-stop flows where Binance requires algo orders:

- `createAlgoOrder(params)` → `POST /fapi/v1/algoOrder`
- `cancelAlgoOrder(symbol, algoId?, clientAlgoId?)` → `DELETE /fapi/v1/algoOrder`
- `cancelAllOpenAlgoOrders(symbol)` → `DELETE /fapi/v1/algoOpenOrders`
- `getAlgoOrder(symbol, algoId?, clientAlgoId?)` → `GET /fapi/v1/algoOrder`
- `getOpenAlgoOrders(symbol?)` → `GET /fapi/v1/openAlgoOrders`
- `getAllAlgoOrders(symbol, options?)` → `GET /fapi/v1/allAlgoOrders`

### WebSocket API trading

Authenticated WebSocket API requests are signed with the same API key and secret used for REST:

```js
await client.wsApiCreateOrder({
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  quantity: 0.001,
  price: 50000,
  timeInForce: 'GTC'
});
```

Available helpers:

- `wsApiRequest(method, params)` for any signed USDⓈ-M WebSocket API method.
- `wsApiCreateOrder(params)` sends `order.place`.
- `wsApiCancelOrder(params)` sends `order.cancel`.
- `wsApiModifyOrder(params)` sends `order.modify`.
- `wsApiCreateAlgoOrder(params)` sends `algoOrder.place`.
- `wsApiCancelAlgoOrder(params)` sends `algoOrder.cancel`.

### Combined market streams and cleanup

- `subscribeCombinedMarketStreams(['btcusdt@aggTrade', 'btcusdt@markPrice'])` opens a combined stream and emits each stream name plus `ws:combined`.
- `closeAllWebSockets()` closes market, user-data, and combined sockets managed by the client.
