#!/usr/bin/env node
'use strict';

const http = require('http');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./server');

async function startStdio() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}

function startHttp() {
  const port = Number(process.env.PORT || process.env.MCP_PORT || 3100);
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/health') {
      res.end(JSON.stringify({ ok: true, name: 'binance-client-js-mcp' }));
      return;
    }
    res.statusCode = 501;
    res.end(JSON.stringify({ error: 'Use stdio for MCP JSON-RPC. HTTP health endpoint is available at /health.' }));
  });
  server.listen(port, () => console.error(`Binance MCP HTTP health server listening on ${port}`));
}

if (process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http') startHttp();
else startStdio().catch((error) => { console.error(error); process.exit(1); });
