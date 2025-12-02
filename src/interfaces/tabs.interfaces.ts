export interface Tab {
    title?: string;
    tabId?: string;
    favicon?: string;
    url?: string;
}

export interface BrowserTabEvent{
    type: string;
    tabs: Tab[];
    profile: string;
}