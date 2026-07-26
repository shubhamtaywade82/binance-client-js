'use strict';

const { createMcpServer } = require('../mcp-server/server');

const server = createMcpServer();
console.log('Created MCP server:', Boolean(server));
console.log('Run `npm run mcp` to start stdio transport for MCP clients.');
