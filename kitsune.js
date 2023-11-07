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
}

const dataStore = new DataStore();

export async function refreshAppearanceForWindow(windowId) {
    const title = await dataStore.getTitleForWindow(windowId);
    await browser.windows.update(windowId, {titlePreface: `[${title}] `});
}
