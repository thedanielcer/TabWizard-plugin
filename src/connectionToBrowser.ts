import WebSocket, { CloseEvent, MessageEvent } from "ws";
import { config } from "./config";
import axios, { AxiosResponse } from "axios";
import { BrowserJson } from "./interfaces/browser-json.interface";
import { TabsFromBrowser } from "./interfaces/tabs-in-browser.interface";
import { GetTabsBrowserResponse, TabClosedResponse, TabInfoChangedResponse, TabInfoResponse } from "./interfaces/browser-responses.interface";
import { BrowserTabEvent, Tab } from "./interfaces/tabs.interfaces";
import { FaviconHandler } from "./faviconHandler";
import { Logger } from "@elgato/streamdeck";
import { blockedUrls } from "./interfaces/blocked-urls";

export class ConnectionToBrowser{
    private socket?: WebSocket;
    private readonly GET_TABS_ID = parseInt("giveMeTheTabs".split('').reduce((sum, char) => sum + char.charCodeAt(0), 0).toString().slice(0, 5));
    private readonly CLOSE_TAB_ID = parseInt("closeTab".split('').reduce((sum, char) => sum + char.charCodeAt(0), 0).toString().slice(0, 5));
    private readonly FOCUS_TAB_ID = parseInt("focusTab".split('').reduce((sum, char) => sum + char.charCodeAt(0), 0).toString().slice(0, 5));
    private readonly GET_TAB_INFO_ID = parseInt("getTabInfo".split('').reduce((sum, char) => sum + char.charCodeAt(0), 0).toString().slice(0, 5));
    private listeners: Array<(event: BrowserTabEvent) => void> = [];
    private profile: number;
    private profileName: string;
    private webSocketUrl?: string;
    private faviconHandler!: FaviconHandler; // = new FaviconHandler;
    private logger!: Logger;
    private blockedUrls = blockedUrls;

    private constructor(profile: string) {
        this.profile = profile === "personal" ? config.debugPortPersonal : config.debugPortWork;
        this.profileName = profile;
    }

    public static async create(logger: Logger, profile: string, listeners: Array<(event: BrowserTabEvent) => void>): Promise<ConnectionToBrowser> {
        const instance = new ConnectionToBrowser(profile);
        listeners.forEach(listener => instance.registerCallback(listener));
        instance.startLoop();
        instance.logger = logger;
        instance.faviconHandler = new FaviconHandler(logger, config.manualOverridesDirectory, config.gitHubIconsDirectory);
        instance.faviconHandler.init();
        return instance;
    }

    private async getBrowserWebSocketUrl(profile: number){
        try {
            const axiosResponse: AxiosResponse<BrowserJson>  = await axios.get(`http://127.0.0.1:${profile}/json/version`);
            
            return axiosResponse.data.webSocketDebuggerUrl;
        } catch (error) {
            return undefined;
        }
    }

    private async startLoop(){
        while (true){
            const url = await this.getBrowserWebSocketUrl(this.profile);
            if(url){
                this.webSocketUrl = url;
                await this.browserConnection();
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    private browserConnection(): Promise<void>{

        return new Promise(resolve => {
            this.socket = new WebSocket(this.webSocketUrl!);
            this.socket.onopen = () => this.handleOpen();
            this.socket.onmessage = (messageEvent: MessageEvent) => this.handleMessageFromBrowser(messageEvent.data);
            this.socket.onerror = () => this.socket?.close();
            this.socket.onclose = () => resolve();
        });
    }

    private handleOpen(){
        this.socket!.send(JSON.stringify({
            id: 1,
            method: "Target.setDiscoverTargets",
            params: {
                discover: true 
            }
        }));
        this.giveMeTheTabs();
    }
    

    public giveMeTheTabs(){
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify({
                id: this.GET_TABS_ID,
                method: "Target.getTargets",
                params: {
                    filter: [
                        {
                            type: "page",
                            exclude: false
                        }
                    ]
                }
            }));
        }
    }

    private async handleMessageFromBrowser(data: WebSocket.Data): Promise<void> {
        try {
            const message: GetTabsBrowserResponse | TabInfoChangedResponse | TabClosedResponse | TabInfoResponse = 
                typeof data === 'string' ? JSON.parse(data) : data as unknown as GetTabsBrowserResponse | TabInfoChangedResponse | TabClosedResponse | TabInfoResponse;
            
            // Handle tab list response
            if ('id' in message && message.id === this.GET_TABS_ID && 'result' in message && 'targetInfos' in message.result) {
                const targetInfos = message.result.targetInfos;
                // Notify listeners with the new tab list
                const filteredTabs = targetInfos.filter((tab) => tab.url && !blockedUrls.includes(tab.url));
                this.listeners.forEach(async listener => listener(await this.convertTabsObjects("all_tabs", filteredTabs, this.profileName)));
                return;
            }

            // Handle tab creation notification
            if('method' in message && message.method === 'Target.targetCreated' && 'params' in message && 'targetInfo' in message.params){
                const targetInfo = message.params.targetInfo;
                if(targetInfo.type === 'page'){
                    if(targetInfo.url && !blockedUrls.includes(targetInfo.url)){
                        this.listeners.forEach(async listener => listener(await this.convertTabsObjects("new_tab", [targetInfo], this.profileName)));
                    }
                }
                return;
            }

            // Handle tab change notification
            if ('method' in message && message.method === 'Target.targetInfoChanged' && 'targetInfo' in message.params) {
                const targetInfo = message.params.targetInfo;
                if (targetInfo.type === 'page') {
                    const targetId = targetInfo.targetId;

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    this.getTabInfo(targetId);
                }
                return;
            }

            // Handle tab close notification
            if ('method' in message && message.method === 'Target.targetDestroyed' && 'targetId' in message.params) {
                const targetId = message.params.targetId;
                this.listeners.forEach(async listener => listener(await this.convertTabsObjects("tab_closed", [{targetId, type: "page", title: "", url: "", attached: false, canAccessOpener: false, browserContextId: "", pid: 0}], this.profileName)));
                return;
            }

            // Handle tab info response
            if ('id' in message && message.id === this.GET_TAB_INFO_ID && 'result' in message && 'targetInfo' in message.result) {
                const targetInfo = message.result.targetInfo;
                // Notify listeners with the new tab info
                // this.logger.debug('sending tab info change - new tab name: ' + targetInfo.title);
                this.listeners.forEach(async listener => listener(await this.convertTabsObjects("tab_info_change", [targetInfo], this.profileName)));
                return;
            }
        } catch (error) {
            return;
        }
    }

    public registerCallback(callback: (event: BrowserTabEvent) => void): void {
        this.listeners.push(callback);
    }

    public sendMessage(tabId: string, operation: string): void {
        switch(operation){
            case "close_tab":
                this.closeTab(tabId);
                break;
            case "focus_tab":
                this.focusTab(tabId);
                break;
            default:
                break;
        }
    }

    private focusTab(tabId: string): void {
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify({
                id: this.FOCUS_TAB_ID,
                method: "Target.activateTarget",
                params: {
                    targetId: tabId
                }
            }));
        }
    }

    private closeTab(tabId: string): void {
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify({
                id: this.CLOSE_TAB_ID,
                method: "Target.closeTarget",
                params: {
                    targetId: tabId
                }
            }));
        }
    }

    private getTabInfo(tabId: string): void {
        // this.logger.debug('getting tab info');
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            this.socket.send(JSON.stringify({
                id: this.GET_TAB_INFO_ID,
                method: "Target.getTargetInfo",
                params: {
                    targetId: tabId
                }
            }));
        }
    }

    private async convertTabsObjects(eventType: string, tabsFromBrowser: TabsFromBrowser[], profile: string): Promise<BrowserTabEvent>{
        const tabs = await Promise.all(tabsFromBrowser.map(async (tab) => ({
            title: tab.title,
            tabId: tab.targetId,
            url: tab.url,
            favicon: await this.faviconHandler.getFavicon(tab.url, this.profile)
        })));
        return {
            type: eventType,
            tabs: tabs,
            profile: profile
        }
    }
}