import { action, JsonObject, KeyDownEvent, Logger, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { TabsOnKeys } from "./tabsOnKeys";

@action({UUID: "com.thedanielcer.tab-wizard.page-setter"})
export class PageSetter extends SingletonAction {
    private page: number = 0;
    constructor(){
        super();
    }
    override onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> | void {
        this.setPage(this.page);
    }

    public setPage(page: number): void {
        this.page = page;
        for (const action of this.actions){
            action.setTitle(`${this.page + 1}`);
        }
    }
    
}