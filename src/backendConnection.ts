import { Logger } from "@elgato/streamdeck";
import WebSocket, { CloseEvent, MessageEvent } from "ws";

export interface Tab {
    title: string;
    tabId: string;
    favicon: string;
    url: string;
}

export interface BackendEvent {
    type: string;
    tabs: Tab[];
    profile: string;
}

export class BackendConnection {
    private socket?: WebSocket;
    private readonly url: string;
    private readonly logger: Logger;
    private listeners: Array<(event: BackendEvent) => void> = [];

    constructor(logger: Logger, url: string = 'ws://127.0.0.1:8766'){
        this.logger = logger;
        this.url = url;
        this.connect();
    }

    private connect(): void {
        this.logger.info(`Connecting to backend at ${this.url}`);
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            this.logger.info('Backend WebSocket connection established');
            this.sendMessage({type: "first_connection", profile: "personal"});
            this.sendMessage({type: "first_connection", profile: "work"});
        };

        this.socket.onmessage = (messageEvent: MessageEvent) => {
            this.handleMessage(messageEvent.data as string);
        };

        this.socket.onerror = () => {
            this.logger.error('Backend WebSocket connection error');
        };

        this.socket.onclose = (ev: CloseEvent) => {
            this.logger.info(`WebSocket connection closed (code: ${ev.code}). Reconnecting in 2 seconds...`);
            setTimeout(() => this.connect(), 2000);
        }
    }

    private handleMessage(data: string): void {
        this.logger.info(`Received message from backend: ${data.slice(0, 100)}`);
        let raw: {
            type: string;
            profile: string;
            tabs: Array<{ title: string; tabId: string; favicon: string; url: string }>;
        };

        try {
            raw = JSON.parse(data);
        } catch {
            this.logger.error(`Invalid JSON from backend: ${data}`);
            return;
        }

        if(raw.tabs.length === 0){
            this.logger.info(`No tabs open for ${raw.profile}`);
            return;
        }

        const event: BackendEvent = {
            type: raw.type,
            profile: raw.profile,
            tabs: raw.tabs.map((tab) => ({
                title: tab.title,
                tabId: tab.tabId,
                favicon: tab.favicon,
                url: tab.url,
            })),
        };

        // dispatch to all registered actions
        for (const fn of this.listeners) fn(event);
    }

    public onEvent(callback: (event: BackendEvent) => void): void {
        this.listeners.push(callback);
    }

    public sendMessage(message: object): void {
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify(message));
        } else {
            this.logger.error('Cannot send message - WebSocket not connected');
        }
    }
        
}
