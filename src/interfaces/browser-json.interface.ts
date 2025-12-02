export interface BrowserJson {
    Browser: string;
    "Protocol-Version": string;
    "User-Agent": string;
    "V8-Version": string;
    "WebKit-Version": string;
    webSocketDebuggerUrl: string;
}

export interface BrowserJsonList{
    description: string;
    devtoolsFrontendUrl: string;
    faviconUrl?: string;
    id: string;
    title: string;
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
}