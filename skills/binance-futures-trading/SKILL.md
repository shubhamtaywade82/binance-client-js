---
name: binance-futures-trading
description: Use for Binance USD-M Futures authenticated trading workflows, including orders, positions, leverage, margin, account state, risk checks, and testnet-first live-trading safeguards.
---

# Binance Futures Trading

- Prefer Binance testnet or demo for all examples unless the user explicitly requests live trading.
- Require `BINANCE_API_KEY` and `BINANCE_API_SECRET` for signed account, position, and trading tools.
- Run `risk_check` before `place_order`, `place_bracket`, `close_position`, leverage, or margin changes.
- Never log secrets, signatures, or full signed URLs.
- Use paper trading first when strategy intent is exploratory.
