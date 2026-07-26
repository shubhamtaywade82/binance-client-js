# Safe trading guidance

- Treat live trading as high risk. Ask for explicit confirmation before adding code paths that place, cancel, or modify live orders.
- Prefer `createTestOrder`, Binance testnet, or Binance demo examples for order workflows.
- Never log API secrets, request signatures, or full authenticated URLs.
- Include validation for symbol, side, order type, quantity, leverage, and margin mode before sending signed requests.
- Keep default MCP tools read-only unless the user explicitly asks for authenticated trading tools.
