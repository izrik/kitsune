export default class DataStore {
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
