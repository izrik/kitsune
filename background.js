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

    for (const window of sleepingWindows) {
        await dataStore.saveSleepingWindow(window);
    }
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

            // Create new window with enhanced state restoration
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

            // Create window with restored properties
            const windowCreateOptions = {
                url: processedUrls
            };

            // Restore window properties if available
            if (sleepingWindowData.windowProperties) {
                const props = sleepingWindowData.windowProperties;
                if (props.state) windowCreateOptions.state = props.state;
                if (props.type) windowCreateOptions.type = props.type;
                if (props.incognito) windowCreateOptions.incognito = props.incognito;
                if (props.top !== undefined) windowCreateOptions.top = props.top;
                if (props.left !== undefined) windowCreateOptions.left = props.left;
                if (props.width) windowCreateOptions.width = props.width;
                if (props.height) windowCreateOptions.height = props.height;
            }

            const newWindow = await browser.windows.create(windowCreateOptions);

            console.log('Background: window created with ID:', newWindow.id);

            // Restore tab-specific properties
            if (sleepingWindowData.tabs && newWindow.tabs) {
                console.log('Background: restoring tab properties...');

                for (let i = 0; i < Math.min(sleepingWindowData.tabs.length, newWindow.tabs.length); i++) {
                    const savedTab = sleepingWindowData.tabs[i];
                    const newTab = newWindow.tabs[i];

                    try {
                        // Restore pinned state
                        if (savedTab.pinned) {
                            await browser.tabs.update(newTab.id, { pinned: true });
                        }

                        // Restore muted state
                        if (savedTab.muted) {
                            await browser.tabs.update(newTab.id, { muted: true });
                        }

                        // Set active tab (find the tab that was active before)
                        if (savedTab.active) {
                            await browser.tabs.update(newTab.id, { active: true });
                        }

                    } catch (tabError) {
                        console.log('Background: error restoring tab properties:', tabError);
                    }
                }
            }

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