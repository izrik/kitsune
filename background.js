// Background script for handling window wake operations
// Can't use ES6 imports in manifest v2 background scripts, so inline the needed functions

async function saveTitleForWindow(windowId, title) {
    console.log(`saveTitleForWindow("${windowId}", "${title}")`);
    await browser.sessions.setWindowValue(windowId, 'userWindowTitle', title);
}

async function saveUuidForWindow(windowId, uuid) {
    console.log(`SaveUuidForWindow("${windowId}", "${uuid}")`);
    await browser.sessions.setWindowValue(windowId, 'userWindowUuid', uuid);
}

async function getSleepingWindows() {
    console.log(`getSleepingWindows()`);
    const sleepingWindows = await browser.storage.local.get('sleepingWindows');
    return sleepingWindows.sleepingWindows || [];
}

async function saveSleepingWindows(sleepingWindows) {
    console.log(`saveSleepingWindows()`);
    await browser.storage.local.set({ sleepingWindows });
}

async function removeSleepingWindow(uuid, currentWindowId) {
    console.log(`removeSleepingWindow("${uuid}", "${currentWindowId}")`);
    const sleepingWindows = await getSleepingWindows();
    const filteredWindows = sleepingWindows.filter(w => w.uuid !== uuid);
    await saveSleepingWindows(filteredWindows);
}

async function refreshAppearanceForWindow(windowId) {
    console.log(`refreshAppearanceForWindow("${windowId}")`);
    const userWindowTitle = await browser.sessions.getWindowValue(windowId, 'userWindowTitle');
    if (userWindowTitle) {
        await browser.windows.update(windowId, { titlePreface: `[${userWindowTitle}] ` });
    }
}

// Listen for messages from popup
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'wakeWindow') {
        console.log('Background: wakeWindow request received');

        try {
            const { sleepingWindowData, currentWindowId } = request;

            // Create new window with the stored tabs
            const urls = sleepingWindowData.tabs.map(tab => tab.url);
            console.log('Background: creating window with URLs:', urls);

            const newWindow = await browser.windows.create({
                url: urls
            });

            console.log('Background: window created with ID:', newWindow.id);

            // Set the window title
            await saveTitleForWindow(newWindow.id, sleepingWindowData.title);

            // Refresh the window appearance with the title
            await refreshAppearanceForWindow(newWindow.id);

            // Save UUID mapping
            await saveUuidForWindow(newWindow.id, sleepingWindowData.uuid);

            // Remove from sleeping windows
            await removeSleepingWindow(sleepingWindowData.uuid, currentWindowId);

            console.log('Background: window wake completed');

        } catch (error) {
            console.error('Background: error waking window:', error);
        }
    }
});

console.log('Background script loaded');