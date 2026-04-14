
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

        // Get existing window data or create new one
        let windowData = await this.getWindowDataForWindow(windowId);
        if (!windowData) {
            windowData = {
                displayTitle: title,
                window: null,
                tabCount: 0,
                isCurrentWindow: false,
                id: windowId,
                title: title,
                tabs: []
            };
        } else {
            windowData.displayTitle = title;
            windowData.title = title;
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

    windowDatasById = {};
    async GetWindowDataById(windowId) {
        return this.windowDatasById[windowId];
    }
    async GetWindowDatas() {
        return Object.values(this.windowDatasById);
    }

    async SetWindowDatas(windowDatas) {
        let fs = [];
        for (const wd of windowDatas) {
            console.debug(`DataStore.SetWindowDatas: ${wd.id} ${wd}`);
            fs.push(dataStore.SetWindowDataForId(wd.id, wd));
        }
        for (const f of fs) {
            await f;
        }
    }

    async SetWindowDataForId(windowId, wd) {
        this.windowDatasById[windowId] = wd;
        return wd;
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
