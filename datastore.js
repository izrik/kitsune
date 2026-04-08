
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
                isSleeping: false,
                sleepingData: null,
                id: windowId,
                title: title,
                state: '',
                uuid: null,
                sleepTime: null,
                tabs: []
            };
        } else {
            windowData.displayTitle = title;
            windowData.title = title;
        }

        await this.saveWindowDataForWindow(windowId, windowData);
    }

    async GetUuidForWindow(windowId) {
        console.debug(`GetUuidForWindow("${windowId}")`);
        if (windowId == null) {
            return null;
        }
        const userWindowUuid = await browser.sessions.getWindowValue(windowId, 'userWindowUuid');
        if (userWindowUuid) {
            return userWindowUuid;
        }

        const uuid = crypto.randomUUID();
        await this.SaveUuidForWindow(windowId, uuid);
        return uuid;
    }

    async SaveUuidForWindow(windowId, uuid) {
        console.debug(`SaveUuidForWindow("${windowId}", "${uuid}")`);
        await browser.sessions.setWindowValue(windowId, 'userWindowUuid', uuid);
        return uuid;
    }

    async getSleepingWindows() {
        console.debug(`getSleepingWindows()`);
        const sleepingWindows = await browser.storage.local.get('sleepingWindows');
        return sleepingWindows.sleepingWindows || [];
    }

    async saveSleepingWindow(windowData) {
        console.debug(`saveSleepingWindow("${windowData}")`);
        const sleepingWindows = await this.getSleepingWindows();

        // Use existing UUID if present, otherwise generate a new one
        const uuid = windowData.uuid || crypto.randomUUID();

        // Add new entry with UUID
        sleepingWindows.push({
            uuid: uuid,
            title: windowData.title,
            tabs: windowData.tabs,
            sleepTime: Date.now()
        });

        await browser.storage.local.set({sleepingWindows: sleepingWindows});
        return uuid;
    }

    async removeSleepingWindow(uuid, currentWindowId) {
        console.debug(`removeSleepingWindow(${uuid}, ${currentWindowId})`);
        const sleepingWindows = await this.getSleepingWindows();
        const filteredWindows = sleepingWindows.filter(w => w.uuid !== uuid);
        await browser.storage.local.set({sleepingWindows: filteredWindows});
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
        await browser.windows.update(windowId, {titlePreface: `[${title}] `});
    }

    windowDatasByUuid = {};
    async GetWindowDataByUuid(uuid) {
        return this.windowDatasByUuid[uuid];
    }
    async GetWindowDatas() {
        let rv = []
        for (const wd of Object.values(this.windowDatasByUuid)) {
            rv.push(wd);
        }
        return rv;
    }

    async SetWindowDatas(windowDatas) {
        let fs = [];
        for (const wd of windowDatas) {
            console.debug(`DataStore.SetWindowDatas: ${wd.uuid} ${wd}`);
            const f = dataStore.SetWindowDataForUuid(wd.uuid, wd);
            fs.push(f);
        }
        for (const f of fs) {
            await f;
        }
    }

    async SetWindowDataForUuid(uuid, wd) {
        this.windowDatasByUuid[uuid] = wd;
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