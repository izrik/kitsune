
export class DataStore {
    constructor() {
        console.debug("DataStore.constructor");
    }

    async getTitleForWindow(windowId) {
        console.debug(`getTitleForWindow(${windowId})`);
        const json = await browser.sessions.getWindowValue(windowId, 'userWindowData');
        const data = json ? JSON.parse(json) : null;
        return data?.displayTitle || '';
    }

    async saveTitleForWindow(windowId, title) {
        console.debug(`saveTitleForWindow("${windowId}", "${title}")`);
        await browser.sessions.setWindowValue(windowId, 'userWindowData', JSON.stringify({ displayTitle: title }));
    }

    async refreshAppearanceForWindow(windowId) {
        console.debug(`refreshAppearanceForWindow(${windowId})`);
        const title = await this.getTitleForWindow(windowId);
        const preface = title?.trim() ? `[${title}] ` : '';
        await browser.windows.update(windowId, {titlePreface: preface});
    }
}

let dataStore = null;

export function getDataStore() {
    console.debug(`getDataStore()`);
    if (dataStore) {
        console.debug(`getDataStore(): dataStore already exists`);
    } else {
        console.debug(`getDataStore(): creating new dataStore`);
        dataStore = new DataStore();
    }
    return dataStore;
}

export function setDataStore(value) {
    console.debug(`setDataStore()`);
    if (dataStore) {
        console.debug(`setDataStore(): dataStore already exists. global not set.`);
    } else {
        console.debug(`setDataStore(): setting dataStore global variable`);
        dataStore = value;
    }
}

export function createDataStore(value) {
    console.debug(`createDataStore()`);
}
