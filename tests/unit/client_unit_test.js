const assert = require('assert');
const { BinanceFuturesClient, BinanceError } = require('../../binance-futures-client');

async function captureRequest(client, call) {
  const calls = [];
  client._request = async (method, path, data, isPublic) => {
    calls.push({ method, path, data, isPublic });
    return { ok: true };
  };
  await call();
  return calls[0];
}

(async () => {
  const prod = new BinanceFuturesClient();
  assert.strictEqual(prod.apiBase, 'https://fapi.binance.com');
  assert.strictEqual(prod.wsBase, 'wss://fstream.binance.com/ws');
  assert.strictEqual(prod.wsApiBase, 'wss://ws-fapi.binance.com/ws-fapi/v1');

  const testnet = new BinanceFuturesClient({ testnet: true });
  assert.strictEqual(testnet.apiBase, 'https://testnet.binancefuture.com');
  assert.strictEqual(testnet.wsBase, 'wss://fstream.binancefuture.com/ws');

  const demo = new BinanceFuturesClient({ demo: true });
  assert.strictEqual(demo.apiBase, 'https://demo-fapi.binance.com');
  assert.strictEqual(demo.wsBase, 'wss://demo-fstream.binance.com/ws');

  const custom = new BinanceFuturesClient({
    apiBase: 'https://proxy.example.test',
    wsBase: 'wss://proxy.example.test/ws',
    wsUserBase: 'wss://proxy.example.test/user',
    wsApiBase: 'wss://proxy.example.test/ws-api'
  });
  assert.strictEqual(custom.apiBase, 'https://proxy.example.test');
  assert.strictEqual(custom.wsBase, 'wss://proxy.example.test/ws');
  assert.strictEqual(custom.wsUserBase, 'wss://proxy.example.test/user');
  assert.strictEqual(custom.wsApiBase, 'wss://proxy.example.test/ws-api');

  assert.strictEqual(prod.normalizeSymbol('B-BTC_USDT'), 'BTCUSDT');
  assert.strictEqual(prod._buildQueryString({ a: 1, b: null, c: undefined, d: 'x y' }), 'a=1&d=x%20y');

  const marketCall = await captureRequest(prod, () => prod.getOpenInterest('B-BTC_USDT'));
  assert.deepStrictEqual(marketCall, {
    method: 'GET',
    path: '/fapi/v1/openInterest',
    data: { symbol: 'BTCUSDT' },
    isPublic: true
  });

  const algoCall = await captureRequest(prod, () => prod.createAlgoOrder({ pair: 'B-BTC_USDT', side: 'SELL' }));
  assert.deepStrictEqual(algoCall, {
    method: 'POST',
    path: '/fapi/v1/algoOrder',
    data: { side: 'SELL', symbol: 'BTCUSDT' },
    isPublic: false
  });

  const currentOrderCall = await captureRequest(prod, () => prod.getCurrentOrder('BTCUSDT', 123));
  assert.strictEqual(currentOrderCall.path, '/fapi/v1/openOrder');
  assert.deepStrictEqual(currentOrderCall.data, { symbol: 'BTCUSDT', orderId: 123, origClientOrderId: undefined });

  const amendmentCall = await captureRequest(prod, () => prod.getOrderModifyHistory('BTCUSDT', { limit: 10 }));
  assert.strictEqual(amendmentCall.path, '/fapi/v1/orderAmendment');
  assert.deepStrictEqual(amendmentCall.data, { symbol: 'BTCUSDT', limit: 10 });

  await assert.rejects(() => prod.wsApiRequest('order.place', {}), BinanceError);

  console.log('client unit tests passed');
})();
