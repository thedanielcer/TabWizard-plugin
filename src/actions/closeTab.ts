import { action, JsonObject, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { TabsOnKeys } from "./tabsOnKeys";

@action({UUID: "com.thedanielcer.tab-wizard.close-tab"})
export class CloseTab extends SingletonAction{
    constructor(private readonly controller: TabsOnKeys){
        super();
    }
    
    override onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> | void {
        const coords = ev.action.coordinates;
        if (!coords) return;
        this.controller.closeTabAt(coords.column, coords.row);
    }
}
