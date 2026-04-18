browser.windows.onCreated.addListener(async (window) => {
    const mod = await import('./datastore.js');
    const store = mod.getDataStore();
    await store.refreshAppearanceForWindow(window.id);
});
