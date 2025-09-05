import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { TabsOnKeys } from "./actions/tabsOnKeys";
import { NextPage } from "./actions/nextPage";
import { PreviousPage } from "./actions/previousPage";
import { CloseTab } from "./actions/closeTab";
import { PageSetter } from "./actions/pageSetter";

streamDeck.logger.setLevel(LogLevel.DEBUG);

const tabsLogger = streamDeck.logger.createScope("TabsOnKeys");

const pageCounterAction = new PageSetter();
// const tabsOnkeysAction = new TabsOnKeys(tabsLogger, pageCounterAction);
const tabsOnkeysAction = await TabsOnKeys.create(tabsLogger, pageCounterAction);
const nextPageAction = new NextPage(tabsOnkeysAction);
const previousPageAction = new PreviousPage(tabsOnkeysAction);
const closeTabAction = new CloseTab(tabsOnkeysAction);

streamDeck.actions.registerAction(tabsOnkeysAction);
streamDeck.actions.registerAction(nextPageAction);
streamDeck.actions.registerAction(previousPageAction);
streamDeck.actions.registerAction(closeTabAction);
streamDeck.actions.registerAction(pageCounterAction);

streamDeck.connect();
