
export class DataStore {
    constructor() {
        console.debug("DataStore.constructor");
    }

    async getTitleForWindow(windowId) {
        console.debug(`getTitleForWindow(${windowId})`);
        const windowData = await this.getWindowDataForWindow(windowId);
        return windowData?.displayTitle || '';
    }

    async saveTitleForWindow(windowId, title) {
        console.debug(`saveTitleForWindow("${windowId}", "${title}")`);
        let windowData = await this.getWindowDataForWindow(windowId);
        if (!windowData) {
            windowData = { id: windowId, displayTitle: title };
        } else {
            windowData.displayTitle = title;
        }
        await this.saveWindowDataForWindow(windowId, windowData);
    }

    async getWindowDataForWindow(windowId) {
        console.debug(`getWindowDataForWindow(${windowId})`);
        const windowDataJson = await browser.sessions.getWindowValue(windowId, 'userWindowData');
        return windowDataJson ? JSON.parse(windowDataJson) : null;
    }

    async saveWindowDataForWindow(windowId, windowData) {
        console.debug(`saveWindowDataForWindow("${windowId}", windowData)`);
        const windowDataJson = JSON.stringify(windowData);
        await browser.sessions.setWindowValue(windowId, 'userWindowData', windowDataJson);
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
