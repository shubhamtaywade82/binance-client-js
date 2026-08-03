---
name: binance-futures-paper-trading
description: Use for risk-free Binance Futures simulation, paper balances, in-memory positions, simulated trade history, strategy rehearsal, and no-key agent trading practice.
---

# Binance Futures Paper Trading

- Use paper tools when the user wants to test strategy ideas without API keys or live orders.
- Initialize with `paper_init` before simulations that need a known starting balance.
- Use real public ticker prices when no simulated entry/exit price is provided.
- State clearly that paper results are in-memory and reset when the MCP process restarts.
