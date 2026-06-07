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

    // WebSocket
    subscribeMarketStream(stream: string): WebSocket;
    subscribeUserStream(): Promise<WebSocket>;
    unsubscribeUserStream(): Promise<void>;
}

export default BinanceFuturesClient;
