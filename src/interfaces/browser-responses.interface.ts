import { TabsFromBrowser } from "./tabs-in-browser.interface";

export interface GetTabsBrowserResponse {
    id: number;
    result: {
        targetInfos: TabsFromBrowser[]
    }
}

export interface TabInfoChangedResponse {
    method: string;
    params: {
        targetInfo: TabsFromBrowser
    }
}

export interface TabClosedResponse {
    method: 'Target.targetDestroyed';
    params: {
        targetId: string;
    }
}

export interface TabCreatedResponse {
    method: 'Target.targetCreated';
    params: {
        targetInfo: TabsFromBrowser
    }
}

export interface TabInfoResponse {
    id: number;
    result: {
        targetInfo: TabsFromBrowser
    }
}