# Binance USDⓈ-M Futures JavaScript Library

A high-performance, feature-complete JavaScript client for the Binance USDⓈ-M Futures API (REST & WebSocket). 

Designed with absolute parity to the `coindcx-client-js` architecture, providing a seamless transition for developers familiar with that ecosystem.

## 🚀 Key Features

- **100% API Coverage:** Every REST endpoint and WebSocket stream defined in the official Binance documentation is implemented.
- **Absolute Parity:** Identical architecture to `coindcx-client-js`, including custom Error classes, Static Utilities, and Liquidation Price logic.
- **Unified Client:** A single class, `BinanceFuturesClient`, manages both high-speed REST calls and robust WebSocket subscriptions.
- **Smart Normalization:** Automatically converts Binance's terse WebSocket fields (e.g., `o`, `ap`, `w`) into readable, normalized objects.
- **Auto-Signing:** Handles HMAC-SHA256 signature generation and timestamping for all authenticated requests automatically.
- **User Data Management:** Built-in `listenKey` lifecycle management (creation, keep-alive, and cleanup) for private account streams.
- **TypeScript Support:** Comprehensive type definitions included for enhanced DX and type safety.

## 📦 Installation

```bash
npm install axios ws dotenv
```

## 🛠 Quick Start

```javascript
const { BinanceFuturesClient } = require('binance-client-js');

const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true, // Use Testnet for safety
    debug: true    // See the URLs and events in console
});

async function run() {
    try {
        // 1. Get Market Data (REST)
        const ticker = await client.getTickerPrice('BTCUSDT');
        console.log(`BTCUSDT Price: ${ticker.price}`);

        // 2. Place an Order (REST - Authenticated)
        // Note: The library accepts both 'pair' (CoinDCX style) and 'symbol' (Binance style)
        const order = await client.createOrder({
            pair: 'B-BTC_USDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: 0.01,
            price: 50000,
            timeInForce: 'GTC'
        });
        console.log('Order Created:', order.orderId);

        // 3. Subscribe to Market Data (WebSocket)
        // Normalized event names match coindcx-client-js: 'candlestick', 'new-trade', etc.
        client.wsSubscribeTrades('BTCUSDT');
        client.on('ws:new-trade', (trade) => {
            console.log(`[Trade] ${trade.symbol}: ${trade.price} x ${trade.quantity}`);
        });

    } catch (err) {
        console.error('Error occurred:', err.message);
    }
}

run();
```

## 📖 Documentation

For a complete reference of all 80+ methods and every available WebSocket stream, please see the:

👉 **[API Documentation Reference](./docs/API_DOCUMENTATION.md)**

## 📂 Project Structure

- `binance-futures-client.js`: Core implementation & normalization engine.
- `binance-futures-client.d.ts`: TypeScript definitions.
- `examples/`: Ready-to-run scripts for common trading flows.
- `tests/`: Comprehensive test suites for public and authenticated features.

## 🛡 Security

- **Credential Protection:** Never hardcode your API keys. Use `.env` files (see `.env.example`).
- **Testnet First:** Always verify your logic on the Binance Testnet before trading with real capital.

## 📜 License

ISC
