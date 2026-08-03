'use strict';
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const text = (uri, data) => ({ contents: [{ uri: uri.href || String(uri), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] });
function symbolFrom(uri) { return String(uri).split('/').pop().toUpperCase(); }
function registerMarketResources(server, { client }) {
  server.registerResource('major-prices', 'binance://futures/prices', { title: 'Major futures prices', description: 'BTCUSDT, ETHUSDT, SOLUSDT, and XRPUSDT prices.' }, async (uri) => text(uri, await Promise.all(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map((s) => client.getTickerPrice(s)))));
  server.registerResource('ticker', new ResourceTemplate('binance://futures/ticker/{symbol}', { list: undefined }), { title: 'Symbol 24h ticker', description: '24 hour ticker for a futures symbol.' }, async (uri) => text(uri, await client.getTicker24h(symbolFrom(uri))));
  server.registerResource('funding', new ResourceTemplate('binance://futures/funding/{symbol}', { list: undefined }), { title: 'Symbol funding rate', description: 'Funding history for a futures symbol.' }, async (uri) => text(uri, await client.getFundingRateHistory(symbolFrom(uri), 10)));
  server.registerResource('open-interest', new ResourceTemplate('binance://futures/openinterest/{symbol}', { list: undefined }), { title: 'Symbol open interest', description: 'Open interest for a futures symbol.' }, async (uri) => text(uri, await client.getOpenInterest(symbolFrom(uri))));
}
module.exports = { registerMarketResources };
