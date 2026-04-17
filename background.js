const dataStore = import("./datastore.js").then((dataStore) => {
    console.debug("background importing dataStore");

    let store = dataStore.getDataStore();
    if (!store) {
        store = new dataStore.DataStore();
        dataStore.setDataStore(store);
    }
});

console.debug("background module-level");

console.debug('Background script loaded');
