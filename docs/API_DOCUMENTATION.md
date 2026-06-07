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

#### `getKlines(symbol, interval, options)`
Kline/candlestick bars for a symbol.

#### `getTickerPrice(symbol)`
24 hour rolling window price change statistics.

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

#### `wsSubscribeAllMarketTickers()`
All Market Tickers updates. Event: `ws:allMarketTickers`.

#### `wsSubscribeAllBookTickers()`
All Book Tickers updates. Event: `ws:allBookTickers`.

#### `wsSubscribeAllLiquidationOrders()`
Market-wide Liquidation Orders. Event: `ws:allLiquidationOrders`.

#### `wsSubscribeCompositeIndex(pair)`
Composite Index Price updates. Event: `ws:compositeIndex`.

#### `subscribeUserStream()`
Subscribe to the user data stream for account updates. Emits `ws:df-order-update`, `ws:balance-update`, etc.
Automatically handles `listenKey` creation and renewal.
