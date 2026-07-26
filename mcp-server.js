#!/usr/bin/env node
'use strict';

const { BinanceFuturesClient } = require('./binance-futures-client');

const SERVER_NAME = 'binance-client-js-mcp';
const SERVER_VERSION = require('./package.json').version;

const client = new BinanceFuturesClient({
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  testnet: process.env.BINANCE_TESTNET === 'true',
  demo: process.env.BINANCE_DEMO === 'true',
  apiBase: process.env.BINANCE_API_BASE,
  wsBase: process.env.BINANCE_WS_BASE,
  wsUserBase: process.env.BINANCE_WS_USER_BASE,
  wsApiBase: process.env.BINANCE_WS_API_BASE
});

const tools = [
  {
    name: 'binance_ping',
    description: 'Ping the configured Binance USD-M Futures REST endpoint.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'binance_server_time',
    description: 'Get Binance USD-M Futures server time.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'binance_ticker_price',
    description: 'Get latest USD-M Futures ticker price for a symbol such as BTCUSDT.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Futures symbol, for example BTCUSDT.' } },
      required: ['symbol'],
      additionalProperties: false
    }
  },
  {
    name: 'binance_mark_price',
    description: 'Get mark price and funding data for a USD-M Futures symbol.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Futures symbol, for example BTCUSDT.' } },
      required: ['symbol'],
      additionalProperties: false
    }
  },
  {
    name: 'binance_order_book',
    description: 'Get the USD-M Futures order book for a symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Futures symbol, for example BTCUSDT.' },
        limit: { type: 'number', description: 'Depth limit. Defaults to 100.' }
      },
      required: ['symbol'],
      additionalProperties: false
    }
  }
];

function normalizeSymbol(symbol) {
  if (typeof symbol !== 'string' || symbol.trim() === '') {
    throw new Error('symbol is required');
  }
  return symbol.trim().toUpperCase();
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'binance_ping':
      return client.getPing();
    case 'binance_server_time':
      return client.getServerTime();
    case 'binance_ticker_price':
      return client.getTickerPrice(normalizeSymbol(args.symbol));
    case 'binance_mark_price':
      return client.getMarkPrice(normalizeSymbol(args.symbol));
    case 'binance_order_book':
      return client.getOrderBook(normalizeSymbol(args.symbol), args.limit || 100);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function success(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function failure(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0') return;
  const { id, method, params = {} } = message;

  try {
    if (method === 'initialize') {
      success(id, {
        protocolVersion: params.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });
      return;
    }

    if (method === 'notifications/initialized') return;

    if (method === 'tools/list') {
      success(id, { tools });
      return;
    }

    if (method === 'tools/call') {
      const result = await callTool(params.name, params.arguments || {});
      success(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      return;
    }

    failure(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    failure(id, -32000, error.message);
  }
}

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length: (\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + length;
    if (buffer.length < messageEnd) return;

    const rawMessage = buffer.slice(messageStart, messageEnd).toString('utf8');
    buffer = buffer.slice(messageEnd);

    Promise.resolve()
      .then(() => handle(JSON.parse(rawMessage)))
      .catch((error) => failure(null, -32700, error.message));
  }
});
