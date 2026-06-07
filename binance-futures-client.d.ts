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

    // Market Data
    getPing(): Promise<any>;
    getTime(): Promise<any>;
    getExchangeInfo(): Promise<any>;
    getOrderBook(symbol: string, limit?: number): Promise<any>;
    getRecentTrades(symbol: string, limit?: number): Promise<any>;
    getKlines(symbol: string, interval: string, options?: any): Promise<any>;
    getTickerPrice(symbol?: string): Promise<any>;
    getOpenInterest(symbol: string): Promise<any>;
    getFundingRate(symbol: string, limit?: number): Promise<any>;
    getMarkPrice(symbol?: string): Promise<any>;

    // Account & Trade
    getAccount(): Promise<any>;
    getBalance(): Promise<any>;
    getPositionRisk(symbol?: string): Promise<any>;
    createOrder(params: any): Promise<any>;
    cancelOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    getOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any>;
    getAllOrders(symbol: string, options?: any): Promise<any>;

    // WebSocket
    subscribeMarketStream(stream: string, callback: (data: any) => void): WebSocket;
    createListenKey(): Promise<string>;
    keepAliveListenKey(): Promise<void>;
    closeListenKey(): Promise<void>;
    subscribeUserStream(callback: (data: any) => void): Promise<WebSocket>;
}

export default BinanceFuturesClient;
