export class DataStore {
    async getTitleForWindow(windowId) {
        const userWindowTitle = await browser.sessions.getWindowValue(windowId, 'userWindowTitle');
        const defaultValue = '';
        return userWindowTitle || defaultValue;
    }

    async saveTitleForWindow(windowId, title) {
        console.log(`saveTitleForWindow("${windowId}", "${title}")`);

        await browser.sessions.setWindowValue(windowId, 'userWindowTitle', title);
    }

    async getSleepingWindows() {
        const sleepingWindows = await browser.storage.local.get('sleepingWindows');
        return sleepingWindows.sleepingWindows || [];
    }

    async saveSleepingWindow(windowData) {
        const sleepingWindows = await this.getSleepingWindows();

        // Generate a unique UUID for this sleeping window
        const uuid = crypto.randomUUID();

        // Add new entry with UUID
        sleepingWindows.push({
            id: uuid,
            originalWindowId: windowData.originalWindowId,
            title: windowData.title,
            tabs: windowData.tabs,
            sleepTime: Date.now()
        });

        await browser.storage.local.set({sleepingWindows: sleepingWindows});
        return uuid;
    }

    async removeSleepingWindow(uuid) {
        const sleepingWindows = await this.getSleepingWindows();
        const filteredWindows = sleepingWindows.filter(w => w.id !== uuid);
        await browser.storage.local.set({sleepingWindows: filteredWindows});
    }
}

const dataStore = new DataStore();

export async function refreshAppearanceForWindow(windowId) {
    const title = await dataStore.getTitleForWindow(windowId);
    await browser.windows.update(windowId, {titlePreface: `[${title}] `});
}
