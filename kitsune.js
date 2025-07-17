export class DataStore {
    async getTitleForWindow(windowId) {
        console.log(`getTitleForWindow("${windowId})`);
        const userWindowTitle = await browser.sessions.getWindowValue(windowId, 'userWindowTitle');
        const defaultValue = '';
        return userWindowTitle || defaultValue;
    }

    async saveTitleForWindow(windowId, title) {
        console.log(`saveTitleForWindow("${windowId}", "${title}")`);

        await browser.sessions.setWindowValue(windowId, 'userWindowTitle', title);
    }

    async GetUuidForWindow(windowId) {
        console.log(`GetUuidForWindow("${windowId})`);
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

    async refreshAppearanceForWindow(windowId) {
        console.log(`refreshAppearanceForWindow(${windowId})`);
        const title = await dataStore.getTitleForWindow(windowId);
        await browser.windows.update(windowId, {titlePreface: `[${title}] `});
    }
}

const dataStore = new DataStore();
