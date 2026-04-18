import {getDataStore} from './datastore.js';

browser.windows.onCreated.addListener(async (window) => {
    const store = getDataStore();
    await store.refreshAppearanceForWindow(window.id);
});
