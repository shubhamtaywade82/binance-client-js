# Binance USDⓈ-M Futures JavaScript Library

A high-performance JavaScript client for the Binance USDⓈ-M Futures API (REST & WebSocket).

## Features

- Full support for REST API (Market Data, Trading, Account)
- WebSocket support for Market Data and User Data streams
- Automatic signature generation (HMAC SHA256)
- Testnet support
- TypeScript definitions included
- Debug mode for easy troubleshooting

## Installation

```bash
npm install axios ws dotenv
```

## Quick Start

```javascript
const BinanceFuturesClient = require('binance-client-js');

const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true
});

// Get Ticker Price
client.getTickerPrice('BTCUSDT').then(console.log);

// Subscribe to Market Stream
client.subscribeMarketStream('btcusdt@aggTrade', (data) => {
    console.log('Trade:', data);
});
```

## API Reference

### Market Data
- `getPing()`
- `getTime()`
- `getExchangeInfo()`
- `getOrderBook(symbol, limit)`
- `getRecentTrades(symbol, limit)`
- `getKlines(symbol, interval, options)`
- `getTickerPrice(symbol)`

### Account & Trade
- `getAccount()`
- `getBalance()`
- `getPositionRisk(symbol)`
- `createOrder(params)`
- `cancelOrder(symbol, orderId, origClientOrderId)`
- `getOrder(symbol, orderId, origClientOrderId)`
- `getOpenOrders(symbol)`
- `getAllOrders(symbol, options)`

### WebSocket
- `subscribeMarketStream(stream, callback)`
- `subscribeUserStream(callback)`

## Examples

Check the `examples/` directory for more usage examples.
