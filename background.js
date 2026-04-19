import {getDataStore} from './datastore.js';

browser.windows.onCreated.addListener(async (window) => {
    const store = getDataStore();
    await store.refreshAppearanceForWindow(window.id);
});

// Session values for restored windows may not be available when onCreated
// fires; refresh again when a tab becomes active in the window.
browser.tabs.onActivated.addListener(async ({windowId}) => {
    const store = getDataStore();
    await store.refreshAppearanceForWindow(windowId);
});
