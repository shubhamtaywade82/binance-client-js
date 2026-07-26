'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { BinanceFuturesClient } = require('../binance-futures-client');
const { registerMarketDataTools } = require('./tools/market-data');
const { registerAccountTools } = require('./tools/account');
const { registerTradingTools } = require('./tools/trading');
const { registerPositionTools } = require('./tools/positions');
const { registerPaperTools } = require('./tools/paper-engine');
const { registerMarketResources } = require('./resources/market-resources');
const { registerTradingPrompts } = require('./prompts/trading-prompts');

function createClient() {
  return new BinanceFuturesClient({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: process.env.BINANCE_TESTNET === 'true',
    demo: process.env.BINANCE_DEMO === 'true',
    apiBase: process.env.BINANCE_API_BASE,
    wsBase: process.env.BINANCE_WS_BASE,
    wsUserBase: process.env.BINANCE_WS_USER_BASE,
    wsApiBase: process.env.BINANCE_WS_API_BASE
  });
}

function createMcpServer(options = {}) {
  const client = options.client || createClient();
  const server = new McpServer({ name: 'binance-client-js-mcp', version: require('../package.json').version });
  const context = { client, paper: { balance: 10000, positions: [], history: [] } };

  registerMarketDataTools(server, context);
  registerAccountTools(server, context);
  registerTradingTools(server, context);
  registerPositionTools(server, context);
  registerPaperTools(server, context);
  registerMarketResources(server, context);
  registerTradingPrompts(server);

  return server;
}

module.exports = { createMcpServer, createClient };
