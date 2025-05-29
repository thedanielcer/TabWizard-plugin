import { action, JsonObject, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { TabsOnKeys } from "./tabsOnKeys";

@action({UUID: "com.thedanielcer.tab-wizard.previous-page"})
export class PreviousPage extends SingletonAction{
    constructor(private readonly controller: TabsOnKeys){
        super();
    }

    override onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> | void {
        this.controller.previousPage();
    }
}
