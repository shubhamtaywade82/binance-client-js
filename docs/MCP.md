# Binance MCP server

This repository includes a lightweight Model Context Protocol (MCP) server for read-only Binance USD-M Futures market-data tools.

## Run locally

```sh
node mcp-server.js
```

After publishing, the package binary can be started with:

```sh
npx binance-client-mcp
```

## Configuration

The server uses the same environment variables as `BinanceFuturesClient`:

| Variable | Purpose |
| --- | --- |
| `BINANCE_TESTNET=true` | Use Binance USD-M Futures testnet endpoints. |
| `BINANCE_DEMO=true` | Use Binance demo endpoints. |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | Configure credentials for future authenticated tools. Current bundled MCP tools are read-only. |
| `BINANCE_API_BASE` | Override the REST base URL for gateways or proxies. |
| `BINANCE_WS_BASE`, `BINANCE_WS_USER_BASE`, `BINANCE_WS_API_BASE` | Override WebSocket endpoints for gateways or proxies. |

## Tools

- `binance_ping`
- `binance_server_time`
- `binance_ticker_price`
- `binance_mark_price`
- `binance_order_book`

All tools return JSON as MCP text content. The initial tool set is intentionally read-only so agents can inspect market data without placing orders.
