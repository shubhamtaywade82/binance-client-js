import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface BinanceFuturesClientOptions {
    apiKey?: string;
    apiSecret?: string;
    testnet?: boolean;
    debug?: boolean;
    recvWindow?: number;
}

export class BinanceFuturesClient extends EventEmitter {
    constructor(options?: BinanceFuturesClientOptions);

    // Public Market Data
    getPing(): Promise<any>;
    getServerTime(): Promise<any>;
    getExchangeInfo(): Promise<any>;
    getOrderBook(symbol: string, limit?: number): Promise<any>;
    getTrades(symbol: string, limit?: number): Promise<any>;
    getHistoricalTrades(symbol: string, limit?: number, fromId?: number): Promise<any>;
    getAggregateTrades(symbol: string, options?: any): Promise<any>;
    getKlines(symbol: string, interval: string, options?: any): Promise<any>;
    getContinuousKlines(symbol: string, contractType: string, interval: string, options?: any): Promise<any>;
    getIndexPriceKlines(symbol: string, interval: string, options?: any): Promise<any>;
    getMarkPriceKlines(symbol: string, interval: string, options?: any): Promise<any>;
    getTickerPrice(symbol?: string): Promise<any>;
    getTicker24h(symbol?: string): Promise<any>;
    getBookTicker(symbol?: string): Promise<any>;
    getTradingDayTicker(symbol?: string): Promise<any>;
    getMarkPrice(symbol?: string): Promise<any>;
    getFundingRateHistory(symbol: string, limit?: number): Promise<any>;
    getInstrumentDetails(symbol: string): Promise<any>;
    normalizeSymbol(symbol: string): string;
    getOpenInterestHistory(symbol: string, period: string, options?: any): Promise<any>;
    getTopLongShortPositionRatio(symbol: string, period: string, options?: any): Promise<any>;
    getTopLongShortAccountRatio(symbol: string, period: string, options?: any): Promise<any>;
    getGlobalLongShortAccountRatio(symbol: string, period: string, options?: any): Promise<any>;
    getTakerBuySellVolume(symbol: string, period: string, options?: any): Promise<any>;
    getBasis(symbol: string, period: string, options?: any): Promise<any>;
    getAssetIndex(symbol?: string): Promise<any>;
    getCompositeIndexInfo(symbol?: string): Promise<any>;
    getAdlQuantile(symbol?: string): Promise<any>;
    getBlvtInfo(tokenName?: string): Promise<any>;
    getIndexPriceConstituents(symbol: string): Promise<any>;
    getSymbolConfig(symbol?: string): Promise<any>;
    getQuantitativeRules(): Promise<any>;
    getForceOrders(options?: any): Promise<any>;
    getInsuranceFundBalance(options?: any): Promise<any>;
    getPmExchangeInfo(): Promise<any>;
    getDelistSchedule(symbol?: string): Promise<any>;
    requestOrderDownload(options?: any): Promise<any>;
    getOrderDownloadStatus(downloadId: string): Promise<any>;
    requestTradeDownload(options?: any): Promise<any>;
    getTradeDownloadStatus(downloadId: string): Promise<any>;

    // Authenticated Account & Trading
    getBalance(): Promise<any>;
    getAccount(): Promise<any>;
    getPositionRisk(symbol?: string): Promise<any>;
    setLeverage(symbol: string, leverage: number): Promise<any>;
    createOrder(params: any): Promise<any>;
    modifyOrder(params: any): Promise<any>;
    createBatchOrders(batchOrders: any[]): Promise<any>;
    modifyBatchOrders(batchOrders: any[]): Promise<any>;
    getOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    cancelOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    cancelBatchOrders(symbol: string, orderIdList?: number[], origClientOrderIdList?: string[]): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any>;
    getAllOrders(symbol: string, options?: any): Promise<any>;
    cancelAllOpenOrders(symbol: string): Promise<any>;
    getUserTrades(symbol: string, options?: any): Promise<any>;
    getIncomeHistory(options?: any): Promise<any>;
    getLeverageBrackets(symbol?: string): Promise<any>;
    getApiTradingStatus(): Promise<any>;
    getPositionMarginHistory(symbol: string, options?: any): Promise<any>;
    getRateLimitOrder(): Promise<any>;
    setCountdownCancelAll(symbol: string, countdownTime: number): Promise<any>;
    getPositionMode(): Promise<any>;
    setPositionMode(dualSidePosition: boolean): Promise<any>;
    setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<any>;
    modifyPositionMargin(symbol: string, amount: string | number, type: 1 | 2): Promise<any>;
    getMultiAssetsMargin(): Promise<any>;
    setMultiAssetsMargin(multiAssetsMargin: boolean): Promise<any>;
    getUserCommissionRate(symbol: string): Promise<any>;
    getFeeBurnStatus(): Promise<any>;
    setFeeBurnStatus(feeBurn: boolean): Promise<any>;

    // WebSocket
    subscribeMarketStream(stream: string, pair?: string, type?: string): WebSocket;
    wsSubscribeCandles(pair: string, interval?: string): WebSocket;
    wsSubscribeOrderBook(pair: string, depth?: number): WebSocket;
    wsSubscribeTrades(pair: string): WebSocket;
    wsSubscribeAllMarketTickers(): WebSocket;
    wsSubscribeAllBookTickers(): WebSocket;
    wsSubscribeAllLiquidationOrders(): WebSocket;
    wsSubscribeLiquidationOrder(pair: string): WebSocket;
    wsSubscribeCompositeIndex(pair: string): WebSocket;
    wsSubscribeAllMarkPrices(): WebSocket;
    wsSubscribeAllAssetIndices(): WebSocket;
    wsSubscribeAssetIndex(asset: string): WebSocket;
    wsSubscribeRollingWindowTicker(pair: string, window?: string): WebSocket;
    wsSubscribeMarkPrice(pair: string, speed?: '1s' | '3s'): WebSocket;
    wsSubscribeContinuousCandles(pair: string, contractType: string, interval?: string): WebSocket;
    wsSubscribeIndexPriceCandles(pair: string, interval?: string): WebSocket;
    wsSubscribeMarkPriceCandles(pair: string, interval?: string): WebSocket;
    wsSubscribeMiniTicker(pair: string): WebSocket;
    wsSubscribeAllMiniTickers(): WebSocket;
    subscribeUserStream(): Promise<WebSocket>;
}

export default BinanceFuturesClient;
