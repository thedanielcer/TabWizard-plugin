import { action, Coordinates, JsonObject, KeyDownEvent, Logger, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { PageSetter } from "./pageSetter";
import { ConnectionToBrowser } from "../connectionToBrowser";
import { BrowserTabEvent, Tab } from '../interfaces/tabs.interfaces';
import { FaviconHandler } from "../faviconHandler";

@action({UUID: "com.thedanielcer.tab-wizard.tabs-on-keys"})
export class TabsOnKeys extends SingletonAction{
    private tabsArrayPersonal: Tab[] = [];
    private tabsArrayWork: Tab[] = [];
    private page = 0;
    private personalProfileRow = 0;
    private workProfileRow = 2;
    private readonly columnOffset = 1;
    private readonly maxKeysPerPage = 6;
    private readonly logger: Logger;
    private personalBrowserConnection!: ConnectionToBrowser;
    private workBrowserConnection!: ConnectionToBrowser;
    private readonly priorityDomains = [
        "youtube",
        "chatgpt",
        "disneyplus",
        "hbomax",
        "github",
        "amazon",
    ];
    private readonly blockedUrls = [
        "edge://discover-chat-v2/",
        "edge://history/hub",
        "edge://downloads/hub",
        "edge://favorites/hub.html",
        "edge://e-drop/",
        "edge://performance-center/hub",
        "edge://shopping/",
    ];

    constructor(logger: Logger, private readonly pageCounter: PageSetter) {
        super();
        this.logger = logger;
    }

    public static async create(logger: Logger, pageCounter: PageSetter): Promise<TabsOnKeys> {
        const instance = new TabsOnKeys(logger, pageCounter);
        instance.personalBrowserConnection = await ConnectionToBrowser.create(logger, "personal", [(event: BrowserTabEvent) => instance.handleBackendEvent(event)]);
        instance.workBrowserConnection = await ConnectionToBrowser.create(logger, "work", [(event: BrowserTabEvent) => instance.handleBackendEvent(event)]);
        return instance;
    }

    private getPriority(tab: Tab): [number, number, string] {
        try {
            if(!tab.url) return [1, 0, ""];
            const url = new URL(tab.url);
            const domain = url.hostname.toLowerCase();
            
            for (let index = 0; index < this.priorityDomains.length; index++) {
                const priorityDomain = this.priorityDomains[index];
                if (domain.includes(priorityDomain)) {
                    return [0, index, domain];
                }
            }
            return [1, 0, domain];
        } catch {
            return [1, 0, ""];
        }
    }

    private sortTabs(tabs: Tab[]): Tab[] {
        return [...tabs].sort((a, b) => {
            const [aPriority, aIndex, aDomain] = this.getPriority(a);
            const [bPriority, bIndex, bDomain] = this.getPriority(b);
            
            if (aPriority !== bPriority) return aPriority - bPriority;
            if (aPriority === 0) return aIndex - bIndex;
            return aDomain.localeCompare(bDomain);
        });
    }

    private handleBackendEvent(event: BrowserTabEvent): void {
        // choose appropriate list & setter
        const list = event.profile === "personal" ? this.tabsArrayPersonal : this.tabsArrayWork;
        const setter = (tabs: Tab[]) => {
            if (event.profile === "personal") this.tabsArrayPersonal = this.sortTabs(tabs)
            else this.tabsArrayWork = this.sortTabs(tabs);
        };
    
        switch (event.type) {
            case "all_tabs":
                this.logger.info(`Set current tabs for ${event.profile}: ${event.tabs.length}`);
                const filteredTabs = event.tabs.filter((tab) => tab.url && !this.blockedUrls.includes(tab.url));
                setter(filteredTabs);
            break;
    
            case "new_tab":
                // if the tab is blocked, don't add it to the list
                this.logger.info(`New tab for ${event.profile}: ${event.tabs[0].tabId}`);

                if(event.tabs[0].url && this.blockedUrls.includes(event.tabs[0].url)) return;
                setter([...list, event.tabs[0]]);
            break;
    
                case "tab_closed":
                    // if the tab is blocked, don't remove it from the list
                if(event.tabs[0].url && this.blockedUrls.includes(event.tabs[0].url)) return;

                this.logger.info(`Tab closed for ${event.profile}: ${event.tabs[0].tabId}`);
                setter(list.filter((t) => t.tabId !== event.tabs[0].tabId));
                const maxPersonal = Math.floor((this.tabsArrayPersonal.length - 1) / this.maxKeysPerPage);
                const maxWork     = Math.floor((this.tabsArrayWork.length - 1) / this.maxKeysPerPage);
                const maxPage     = Math.max(maxPersonal, maxWork);
                if(this.page > maxPage) this.page = maxPage;
            break;

            case "tab_info_change":
                // if the tab is blocked, don't add it to the list
                if(event.tabs[0].url && this.blockedUrls.includes(event.tabs[0].url)) return;

                // if the tab is already in the list, update it
                if(this.isTabInArray(event.tabs[0], list)){
                    // if the tab is in the list, update it
                    this.logger.info(`Tab info change for ${event.profile}: ${event.tabs[0].tabId}`);
                    setter(list.map((tab) => tab.tabId === event.tabs[0].tabId ? event.tabs[0] : tab));
                } else {
                    // if the tab is not in the list, add it
                    setter([...list, event.tabs[0]]);
                }
                break;
    
            default:
                this.logger.info(`Unhandled event: ${event.type}`);
            break;
        }
    
        this.renderPage();
    }

    override onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> | void {
        this.logger.info('onWillAppear happened');
        this.personalBrowserConnection.giveMeTheTabs();
        this.workBrowserConnection.giveMeTheTabs();
        if(!ev.action.coordinates) return;
        this.renderPage();
    }

    override onWillDisappear(ev: WillDisappearEvent<JsonObject>): Promise<void> | void {
        this.page = 0;
    }

    override onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> | void {
        if(!ev.action.coordinates) return;
        const {row, column} = ev.action.coordinates;

        const isPersonalRow = row === this.personalProfileRow;
        const isWorkRow = row === this.workProfileRow;
        if (!isPersonalRow && !isWorkRow) return;

        const idx = this.getTabsArrayIndex(column);
        const list = isPersonalRow ? this.tabsArrayPersonal : this.tabsArrayWork;

        if(idx < 0 || idx >= list.length) return;

        const tab = list[idx]!;
        if(!tab.tabId) return;
        if(isPersonalRow) this.personalBrowserConnection.sendMessage(tab.tabId, "focus_tab");
        else this.workBrowserConnection.sendMessage(tab.tabId, "focus_tab");
    }

    private renderPage(): void {
        this.logger.info('Rendering page');
        for (const action of this.actions){
            if (!action.isKey() || !action.coordinates) continue;
            const { row, column } = action.coordinates;
            // only rows 0 or 2
            const list = row === this.personalProfileRow
                ? this.tabsArrayPersonal
                : row === this.workProfileRow
                ? this.tabsArrayWork
                : null;

            if (!list) {
                action.setImage(""); action.setTitle("tab not\non list");
                continue;
            }

            const idx = this.getTabsArrayIndex(column);
            const tab = list[idx];

            if (tab) {
                action.setImage(tab.favicon)
                action.setTitle(tab.title?.slice(0, 10) ?? "");
            } else {
                action.setImage(""); action.setTitle("");
            }
        }
        this.pageCounter.setPage(this.page);
    }

    private getTabsArrayIndex(column: number): number {
        return this.page * this.maxKeysPerPage + (column - this.columnOffset);
    }

    public nextPage(): void {
        const maxPersonal = Math.floor((this.tabsArrayPersonal.length - 1) / this.maxKeysPerPage);
        const maxWork     = Math.floor((this.tabsArrayWork.length - 1) / this.maxKeysPerPage);
        const maxPage     = Math.max(maxPersonal, maxWork);
        this.page = Math.min(this.page + 1, maxPage);
        this.renderPage();
    }

    public previousPage(): void {
        if(this.page > 0){
            this.page = Math.max(this.page - 1, 0);
            this.renderPage();
        }
    }

    public closeTabAt(column: number, row: number): void {
        this.logger.info(`Closing tab at ${column}, ${row}`);
        const isPersonal = row === this.personalProfileRow+1;
        const list = isPersonal ? this.tabsArrayPersonal : this.tabsArrayWork;
        const idx = this.getTabsArrayIndex(column);
        
        if(idx < 0 || idx >= list.length) {
            this.logger.info(`Invalid index: ${idx}, list length: ${list.length}`);
            return;
        }

        const tab = list[idx];
        const profile = isPersonal ? "personal" : "work";
        this.logger.info(`profile: ${profile}`);
        if(!tab.tabId) return;
        if(isPersonal) this.personalBrowserConnection.sendMessage(tab.tabId, "close_tab");
        else this.workBrowserConnection.sendMessage(tab.tabId, "close_tab");
    }

    public getPage(): number {
        return this.page;
    }

    private isTabInArray(tab: Tab, array: Tab[]): boolean {
        return array.some((t) => t.tabId === tab.tabId);
    }
}
