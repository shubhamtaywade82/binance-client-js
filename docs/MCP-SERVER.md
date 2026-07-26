# MCP server

The repository includes a Binance USD-M Futures MCP server with public market data, signed account/trading/position tools, in-memory paper trading tools, resources, and prompts.

## Commands

```sh
npm run mcp
npm run mcp:http
```

`npm run mcp` starts stdio transport for Claude Desktop, Cursor, VS Code, and other local MCP clients. `npm run mcp:http` exposes a lightweight HTTP health endpoint on `PORT`/`MCP_PORT` (default `3100`) for remote process checks.

## Environment

- `BINANCE_TESTNET=true` or `BINANCE_DEMO=true` for safe endpoints.
- `BINANCE_API_KEY` and `BINANCE_API_SECRET` for signed tools.
- `BINANCE_API_BASE`, `BINANCE_WS_BASE`, `BINANCE_WS_USER_BASE`, and `BINANCE_WS_API_BASE` for gateway/proxy overrides.

## Safety

Market-data and paper tools do not require keys. Signed trading tools are available for authenticated workflows; use testnet/demo first and run the `risk_check` prompt before placing live orders.
