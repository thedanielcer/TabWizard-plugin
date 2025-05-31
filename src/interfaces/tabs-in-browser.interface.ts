export interface TabsFromBrowser {
    targetId: string;
    type: string;
    title: string;
    url: string;
    attached: boolean;
    canAccessOpener: boolean;
    browserContextId: string;
    pid: number;
}