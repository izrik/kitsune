// Background script for handling window wake operations
// Can't use ES6 imports in manifest v2 background scripts, so inline the needed functions

let dataStore = null;

const kitsune = import("./kitsune.js").then((kitsune) => {
    dataStore = new kitsune.DataStore();
});


async function saveTitleForWindow(windowId, title) {
    return await dataStore.saveTitleForWindow(windowId, title);
}

async function saveUuidForWindow(windowId, uuid) {
    return await dataStore.SaveUuidForWindow(windowId, uuid);
}

async function getSleepingWindows() {
    return await dataStore.getSleepingWindows();
}

async function saveSleepingWindows(sleepingWindows) {
    await dataStore.saveSleepingWindows(sleepingWindows);
}

async function removeSleepingWindow(uuid, currentWindowId) {
    await dataStore.removeSleepingWindow(uuid, currentWindowId);
}

async function refreshAppearanceForWindow(windowId) {
    await dataStore.refreshAppearanceForWindow(windowId);
}

// Listen for messages from popup
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'wakeWindow') {
        console.log('Background: wakeWindow request received');

        try {
            const { sleepingWindowData, currentWindowId } = request;

            // Create new window with the stored tabs
            const allUrls = sleepingWindowData.tabs.map(tab => tab.url);
            console.log('Background: all URLs from sleeping window:', allUrls);

            // Replace privileged URLs that can't be opened by extensions with about:blank
            const processedUrls = allUrls.map(url => {
                const isValid = !url.startsWith('about:') && 
                               !url.startsWith('chrome:') && 
                               !url.startsWith('moz-extension:') &&
                               !url.startsWith('resource:');
                if (!isValid) {
                    console.log('Background: replacing invalid URL with about:blank:', url);
                    return 'about:blank';
                }
                return url;
            });

            console.log('Background: creating window with processed URLs:', processedUrls);

            const urlsToCreate = processedUrls;

            const newWindow = await browser.windows.create({
                url: urlsToCreate
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