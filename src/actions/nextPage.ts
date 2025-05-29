import { action, KeyDownEvent, JsonObject, SingletonAction } from "@elgato/streamdeck";
import { TabsOnKeys } from "./tabsOnKeys";

@action({UUID: "com.thedanielcer.tab-wizard.next-page"})
export class NextPage extends SingletonAction {
    constructor(private readonly controller: TabsOnKeys){
        super();
    }

    override onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> | void {
        this.controller.nextPage();
    }
}
