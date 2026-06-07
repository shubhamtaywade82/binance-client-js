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
    getKlines(symbol: string, interval: string, options?: any): Promise<any>;
    getTickerPrice(symbol?: string): Promise<any>;
    getMarkPrice(symbol?: string): Promise<any>;
    getFundingRateHistory(symbol: string, limit?: number): Promise<any>;
    getOpenInterestHistory(symbol: string, period: string, options?: any): Promise<any>;
    getTopLongShortPositionRatio(symbol: string, period: string, options?: any): Promise<any>;
    getTopLongShortAccountRatio(symbol: string, period: string, options?: any): Promise<any>;
    getGlobalLongShortAccountRatio(symbol: string, period: string, options?: any): Promise<any>;
    getTakerBuySellVolume(symbol: string, period: string, options?: any): Promise<any>;
    getBasis(symbol: string, period: string, options?: any): Promise<any>;
    getAssetIndex(symbol?: string): Promise<any>;
    getAdlQuantile(symbol?: string): Promise<any>;

    // Authenticated Account & Trading
    getBalance(): Promise<any>;
    getAccount(): Promise<any>;
    getPositionRisk(symbol?: string): Promise<any>;
    setLeverage(symbol: string, leverage: number): Promise<any>;
    createOrder(params: any): Promise<any>;
    getOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    cancelOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any>;
    getAllOrders(symbol: string, options?: any): Promise<any>;
    getPositionMode(): Promise<any>;
    setPositionMode(dualSidePosition: boolean): Promise<any>;
    getMultiAssetsMargin(): Promise<any>;
    setMultiAssetsMargin(multiAssetsMargin: boolean): Promise<any>;
    getUserCommissionRate(symbol: string): Promise<any>;
    getFeeBurnStatus(): Promise<any>;
    setFeeBurnStatus(feeBurn: boolean): Promise<any>;

    // WebSocket
    subscribeMarketStream(stream: string): WebSocket;
    subscribeAllMarketTickers(): WebSocket;
    subscribeAllBookTickers(): WebSocket;
    subscribeAllLiquidationOrders(): WebSocket;
    subscribeUserStream(): Promise<WebSocket>;
    unsubscribeUserStream(): Promise<void>;
}

export default BinanceFuturesClient;
