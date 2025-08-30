export class DataStore {
    async getTitleForWindow(windowId) {
        console.log(`getTitleForWindow(${windowId})`);
        const windowData = await this.getWindowDataForWindow(windowId);
        return windowData?.displayTitle || '';
    }

    async saveTitleForWindow(windowId, title) {
        console.log(`saveTitleForWindow("${windowId}", "${title}")`);

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
        console.log(`GetUuidForWindow("${windowId}")`);
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
        console.log(`SaveUuidForWindow("${windowId}", "${uuid}")`);
        await browser.sessions.setWindowValue(windowId, 'userWindowUuid', uuid);
        return uuid;
    }

    async getSleepingWindows() {
        console.log(`getSleepingWindows()`);
        const sleepingWindows = await browser.storage.local.get('sleepingWindows');
        return sleepingWindows.sleepingWindows || [];
    }

    async saveSleepingWindow(windowData) {
        console.log(`saveSleepingWindow("${windowData}")`);
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
        console.log(`removeSleepingWindow(${uuid}, ${currentWindowId})`);
        const sleepingWindows = await this.getSleepingWindows();
        const filteredWindows = sleepingWindows.filter(w => w.uuid !== uuid);
        await browser.storage.local.set({sleepingWindows: filteredWindows});
    }

    async getWindowDataForWindow(windowId) {
        console.log(`getWindowDataForWindow(${windowId})`);
        const windowDataJson = await browser.sessions.getWindowValue(windowId, 'userWindowData');
        return windowDataJson ? JSON.parse(windowDataJson) : null;
    }

    async saveWindowDataForWindow(windowId, windowData) {
        console.log(`saveWindowDataForWindow("${windowId}", windowData)`);
        const windowDataJson = JSON.stringify(windowData);
        await browser.sessions.setWindowValue(windowId, 'userWindowData', windowDataJson);
    }

    async refreshAppearanceForWindow(windowId) {
        console.log(`refreshAppearanceForWindow(${windowId})`);
        const title = await this.getTitleForWindow(windowId);
        await browser.windows.update(windowId, {titlePreface: `[${title}] `});
    }

    windowDatasByUuid = {};
    async GetWindowDataByUuid(uuid) {
        return this.windowDatasByUuid[uuid];
    }
    async GetWindowDatas() {
        let rv = []
        for (const wd in Object.values(this.windowDatasByUuid)) {
            rv.push(wd);
        }
        return rv;
    }
    async SetWindowDataForUuid(uuid, wd) {
        this.windowDatasByUuid[uuid] = wd;
        return wd;
    }
}

export class WindowData {
    constructor(options = {}) {
        this.window = options.window || null;                       // runtime only
        this.displayTitle = options.displayTitle || '';             // constant; what's the difference between this and "title"?
        this.tabCount = options.tabCount || 0;                      // get at run time when needed
        this.isCurrentWindow = options.isCurrentWindow || false;    // don't store
        this.isSleeping = options.isSleeping || false;              //
        this.sleepingData = options.sleepingData || null;           // ???
        this.id = options.id || null;                               //
        this.title = options.title || '';                           // what's the difference between this and "displayTitle"?
        this.state = options.state || '';                           // get at runtime when putting to sleep
        this.uuid = options.uuid || null;                           // constant
        this.sleepTime = options.sleepTime || null;                 // get at runtime when putting to sleep
        this.tabs = options.tabs || [];                             // get at runtime when putting to sleep
    }
}

const dataStore = new DataStore();
