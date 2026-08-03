# Binance USDⓈ-M Futures JavaScript Library

[![CI/CD Pipeline](https://github.com/shubhamtaywade82/binance-client-js/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/shubhamtaywade82/binance-client-js/actions/workflows/ci-cd.yml)
[![Code Quality](https://github.com/shubhamtaywade82/binance-client-js/actions/workflows/code-quality.yml/badge.svg)](https://github.com/shubhamtaywade82/binance-client-js/actions/workflows/code-quality.yml)
[![npm version](https://img.shields.io/npm/v/binance-client.svg)](https://www.npmjs.com/package/binance-client)
[![npm downloads](https://img.shields.io/npm/dm/binance-client.svg)](https://www.npmjs.com/package/binance-client)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A high-performance, feature-complete JavaScript client for the Binance USDⓈ-M Futures API (REST & WebSocket). 

Designed with absolute parity to the `coindcx-client-js` architecture, providing a seamless transition for developers familiar with that ecosystem.

## 🚀 Key Features

- **100% API Coverage:** Every REST endpoint and WebSocket stream defined in the official Binance documentation is implemented.
- **AI Agent Skills Ready:** Pre-built skills adapter for integrating with AI assistants, chatbots, and automated trading agents.
- **Absolute Parity:** Identical architecture to `coindcx-client-js`, including custom Error classes, Static Utilities, and Liquidation Price logic.
- **Unified Client:** A single class, `BinanceFuturesClient`, manages both high-speed REST calls and robust WebSocket subscriptions.
- **Smart Normalization:** Automatically converts Binance's terse WebSocket fields (e.g., `o`, `ap`, `w`) into readable, normalized objects.
- **Auto-Signing:** Handles HMAC-SHA256 signature generation and timestamping for all authenticated requests automatically.
- **User Data Management:** Built-in `listenKey` lifecycle management (creation, keep-alive, and cleanup) for private account streams.
- **TypeScript Support:** Comprehensive type definitions included for enhanced DX and type safety.

## Installation

```bash
npm install axios ws dotenv
```

## Usage

See the [Quick Start](#-quick-start) section below for basic usage examples.

## 🛠 Quick Start

```javascript
const { BinanceFuturesClient } = require('binance-client-js');

const client = new BinanceFuturesClient({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    testnet: true, // Uses Binance USDⓈ-M Futures testnet endpoints
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


### Current USDⓈ-M Futures coverage

This client now exposes production, Binance testnet, and Binance demo URL defaults for REST, market-stream WebSockets, and the signed WebSocket API. You can override `apiBase`, `wsBase`, `wsUserBase`, or `wsApiBase` for private gateways, proxies, or MCP adapters.

Recent USDⓈ-M additions include open interest, funding info, v2 ticker/book ticker helpers, v3 account/position helpers, test/current-order and order-modify-history helpers, Algo Service conditional-order endpoints, signed WebSocket API trading (`order.place`, `order.cancel`, `order.modify`, `algoOrder.place`, `algoOrder.cancel`), combined market streams, and `closeAllWebSockets()`/`closeUserStream()` cleanup.


## ✅ CI/CD Verification

This repository includes GitHub Actions workflows for pull requests, branch pushes, manual verification, and release publishing:

- **CI** runs on Node.js 20, 22, and 24 with `npm ci`, syntax checks, offline unit tests, export verification, npm package dry-run validation, and a production dependency security audit.
- **Release** reruns the full verification pipeline before `npm publish`, with a manual dry-run option for validating release credentials and package contents safely.

Local equivalent:

```bash
npm run verify
```

## 📖 Documentation

For a complete reference of all 80+ methods and every available WebSocket stream, please see the:

👉 **[API Documentation Reference](./docs/API_DOCUMENTATION.md)**

## API Reference

This library provides comprehensive API coverage for Binance USDⓈ-M Futures. Below is a summary of the main categories:

### REST API Methods

**Market Data:**
- `getTickerPrice(symbol)` - Get current ticker price
- `getOrderBook(symbol, limit)` - Get order book depth
- `getRecentTrades(symbol, limit)` - Get recent trades
- `getKlines(symbol, interval, options)` - Get candlestick data
- `getOpenInterest(symbol)` - Get open interest statistics
- `getFundingRate(symbol, options)` - Get funding rate history

**Account & Trading:**
- `createOrder(params)` - Place a new order
- `cancelOrder(params)` - Cancel an existing order
- `getOrder(params)` - Query order status
- `getOpenOrders(params)` - Get all open orders
- `getBalance()` - Get account balance
- `getPositionRisk()` - Get position risk information

### WebSocket Streams

**Market Streams:**
- `wsSubscribeTrades(symbol)` - Subscribe to trade updates
- `wsSubscribeCandlesticks(symbol, interval)` - Subscribe to kline/candlestick updates
- `wsSubscribeOrderBook(symbol, level)` - Subscribe to order book updates
- `wsSubscribeTicker(symbol)` - Subscribe to 24hr ticker

**User Streams:**
- `startUserStream()` - Start user data stream
- `keepAliveUserStream(listenKey)` - Keep user stream alive
- `closeUserStream()` - Close user data stream

For detailed method signatures, parameters, and examples, see the full [API Documentation](./docs/API_DOCUMENTATION.md).

## 📂 Project Structure

- `binance-futures-client.js`: Core implementation & normalization engine.
- `binance-futures-client.d.ts`: TypeScript definitions.
- `examples/`: Ready-to-run scripts for common trading flows.
  - `ai-agent-skills.js`: AI Agent Skills adapter for USD-M Futures
  - `ai-agent-skills-demo.js`: Demo and usage examples for AI Agent Skills
- `tests/`: Comprehensive test suites for public and authenticated features.
- `docs/`: Documentation
  - `API_DOCUMENTATION.md`: Complete API reference
  - `AI_AGENT_SKILLS_INTEGRATION.md`: Guide for integrating with AI agents
- `.github/workflows/`: CI/CD pipelines
  - `ci-cd.yml`: Main CI/CD pipeline with automated NPM publishing
  - `npm-publish-manual.yml`: Manual trigger for version bumping and publishing
  - `code-quality.yml`: Security audits, license checks, documentation validation
  - `release-drafter.yml`: Automated release notes generation

## 🚀 CI/CD and Publishing

This repository includes comprehensive GitHub Actions workflows for automated testing, security auditing, and NPM publishing.

### Automated Publishing Flow

1. **Create a GitHub Release:**
   - Go to **Releases** → **Draft a new release**
   - Create a tag (e.g., `v1.0.1`)
   - Publish the release
   - CI/CD pipeline automatically runs tests and publishes to NPM

2. **Manual Publishing:**
   - Go to **Actions** tab
   - Select **"NPM Publish (Manual Trigger)"**
   - Choose version bump type (patch/minor/major)
   - Select publish tag (latest/beta/alpha)
   - Run workflow

### Required Secrets

Configure these in **Repository Settings** → **Secrets and variables** → **Actions**:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | NPM automation token for publishing |

See [GitHub Workflows Guide](.github/workflows/README_WORKFLOWS.md) for detailed documentation.

## 🛡 Security

- **Credential Protection:** Never hardcode your API keys. Use `.env` files (see `.env.example`).
- **Testnet First:** Always verify your logic on the Binance Testnet before trading with real capital.

## 📜 License

ISC
