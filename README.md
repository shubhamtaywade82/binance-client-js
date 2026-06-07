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
const { BinanceFuturesClient } = require('binance-client-js');
```
const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true
});

async function run() {
    // Get Ticker Price
    const ticker = await client.getTickerPrice('BTCUSDT');
    console.log('BTCUSDT Price:', ticker.price);

    // Subscribe to Market Stream
    client.subscribeMarketStream('btcusdt@aggTrade');
    client.on('btcusdt@aggTrade', (data) => {
        console.log('Trade:', data.p, data.q);
    });
}

run();
```

## Documentation

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for detailed method references.

## Examples

Check the `examples/` directory for more usage examples.
