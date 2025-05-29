import streamDeck, { action, JsonObject, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

@action({UUID: "com.thedanielcer.tab-wizard.switch-profile"})
export class SwitchProfile extends SingletonAction{
    override onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> | void {
        streamDeck.profiles.switchToProfile(ev.action.device.id)
    }
}
