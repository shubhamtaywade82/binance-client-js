---
name: binance-crypto-agent
description: Use when Codex needs to build, audit, test, or operate Binance USD-M Futures crypto-agent workflows in this repository, including safe public market-data analysis, testnet/demo setup, endpoint overrides, and the bundled MCP server tools.
---

# Binance Crypto Agent

## Core workflow

1. Prefer public, read-only market-data operations unless the user explicitly requests authenticated account or trading behavior.
2. Default to Binance testnet or demo for examples that could place orders; never hard-code secrets.
3. Use `BinanceFuturesClient` from `binance-futures-client.js` for code changes.
4. Use the bundled MCP server (`mcp-server.js`) when an agent needs tool access to Binance data over Model Context Protocol.
5. Run `npm run verify` after changing client, MCP, or workflow files.

## Environment variables

- `BINANCE_TESTNET=true` selects USD-M Futures testnet defaults.
- `BINANCE_DEMO=true` selects demo defaults.
- `BINANCE_API_KEY` and `BINANCE_API_SECRET` enable authenticated client methods.
- `BINANCE_API_BASE`, `BINANCE_WS_BASE`, `BINANCE_WS_USER_BASE`, and `BINANCE_WS_API_BASE` override endpoints for local gateways, proxies, or MCP adapters.

## MCP usage

Start the server with:

```sh
npx binance-client-mcp
```

For local development inside this repo, run:

```sh
node mcp-server.js
```

The server exposes read-only tools for ping, server time, ticker price, mark price, and order book. Keep trading operations out of MCP unless a future change includes explicit user confirmation and testnet-first safeguards.

## References

Read `references/safe-trading.md` before adding authenticated or order-placing behavior.
