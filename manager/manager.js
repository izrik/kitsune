import {DataStore} from '/kitsune.js';

const dataStore = new DataStore();

class WindowData {
    constructor(options = {}) {
        this.window = options.window || null;
        this.displayTitle = options.displayTitle || '';
        this.tabCount = options.tabCount || 0;
        this.isCurrentWindow = options.isCurrentWindow || false;
        this.isSleeping = options.isSleeping || false;
        this.sleepingData = options.sleepingData || null;
        this.id = options.id || null;
        this.title = options.title || '';
        this.state = options.state || '';
        this.uuid = options.uuid || null;
        this.sleepTime = options.sleepTime || null;
        this.tabs = options.tabs || [];
    }
}

async function getWindowAndTabCounts() {
    const windows = await browser.windows.getAll({populate: true});
    const currentWindow = await browser.windows.getCurrent({populate: true});
    const sleepingWindows = await dataStore.getSleepingWindows();

    const totalWindows = windows.length + sleepingWindows.length;
    const totalTabs = windows.reduce((sum, window) => sum + window.tabs.length, 0) +
                     sleepingWindows.reduce((sum, window) => sum + window.tabs.length, 0);
    const currentWindowTabs = currentWindow.tabs.length;

    return {
        totalWindows,
        totalTabs,
        currentWindowTabs
    };
}

async function sleepWindow(windowData) {
    try {
        // Store comprehensive window state
        const windowState = {
            originalWindowId: windowData.window.id,
            title: windowData.displayTitle,
            windowProperties: {
                focused: windowData.window.focused,
                incognito: windowData.window.incognito,
                state: windowData.window.state,
                type: windowData.window.type,
                top: windowData.window.top,
                left: windowData.window.left,
                width: windowData.window.width,
                height: windowData.window.height
            },
            tabs: windowData.window.tabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                index: tab.index,
                pinned: tab.pinned,
                active: tab.active,
                muted: tab.mutedInfo?.muted || false,
                discarded: tab.discarded,
                autoDiscardable: tab.autoDiscardable
            }))
        };

        const uuid = await dataStore.saveSleepingWindow(windowState);

        // Close the window
        await browser.windows.remove(windowData.window.id);

        console.log('Window put to sleep with UUID:', uuid, 'Title:', windowData.displayTitle);

        // Refresh the window
        await refreshManager();

    } catch (error) {
        console.error('Error sleeping window:', error);
    }
}

async function wakeWindow(sleepingWindowData, currentWindowId) {
    try {
        console.log(`wakeWindow(${sleepingWindowData} -> {uuid: ${sleepingWindowData.uuid}, title: ${sleepingWindowData.title}, tabs: ${sleepingWindowData.tabs}, sleepTime: ${sleepingWindowData.sleepTime})`);

        // Send message to background script to handle window creation
        console.log('wakeWindow, sending message to background script...');

        // Send message without waiting for response to avoid context issues
        browser.runtime.sendMessage({
            action: 'wakeWindow',
            sleepingWindowData: sleepingWindowData,
            currentWindowId: currentWindowId
        }).catch(error => {
            console.log('Message sending failed, but background should still handle it:', error);
        });

        console.log('wakeWindow, message sent to background script');

    } catch (error) {
        console.error('Error waking window:', error);
    }
}

function showWindowInfo(windowData) {
    const detailsContainer = document.querySelector('#window-details');
    const detailsContent = document.querySelector('#window-details-content');

    let detailsHtml = '';

    // Basic window information
    detailsHtml += `<div class="detail-row"><span class="detail-label">Title:</span> ${windowData.displayTitle}</div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Status:</span> ${windowData.isSleeping ? 'Sleeping' : 'Open'}</div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Tabs:</span> ${windowData.tabCount}</div>`;

    if (windowData.isCurrentWindow) {
        detailsHtml += `<div class="detail-row"><span class="detail-label">Current:</span> Yes</div>`;
    }

    if (windowData.isSleeping && windowData.sleepingData) {
        if (windowData.sleepingData.sleepTime) {
            const sleepDate = new Date(windowData.sleepingData.sleepTime);
            detailsHtml += `<div class="detail-row"><span class="detail-label">Sleep Time:</span> ${sleepDate.toLocaleString()}</div>`;
        }
        if (windowData.sleepingData.uuid) {
            detailsHtml += `<div class="detail-row"><span class="detail-label">UUID:</span> ${windowData.sleepingData.uuid}</div>`;
        }
    }

    if (!windowData.isSleeping && windowData.window) {
        detailsHtml += `<div class="detail-row"><span class="detail-label">ID:</span> ${windowData.window.id}</div>`;
        if (windowData.window.type) {
            detailsHtml += `<div class="detail-row"><span class="detail-label">Type:</span> ${windowData.window.type}</div>`;
        }
        if (windowData.window.state) {
            detailsHtml += `<div class="detail-row"><span class="detail-label">State:</span> ${windowData.window.state}</div>`;
        }
    }

    // Tabs information
    const tabs = windowData.isSleeping ? windowData.sleepingData?.tabs : windowData.window?.tabs;
    if (tabs && tabs.length > 0) {
        detailsHtml += `<div class="detail-row"><span class="detail-label">Tabs:</span></div>`;
        detailsHtml += `<div class="tabs-list">`;
        tabs.forEach((tab, index) => {
            const tabTitle = tab.title || 'Untitled';
            const tabUrl = tab.url || '';
            detailsHtml += `<div class="tab-item">${index + 1}. ${tabTitle}`;
            if (tabUrl && tabUrl !== tabTitle) {
                detailsHtml += `<br>&nbsp;&nbsp;&nbsp;<small>${tabUrl}</small>`;
            }
            detailsHtml += `</div>`;
        });
        detailsHtml += `</div>`;
    }

    detailsContent.innerHTML = detailsHtml;
    detailsContainer.classList.add('visible');
}

async function refreshManager() {
    const counts = await getWindowAndTabCounts();
    document.querySelector('#window-count').textContent = counts.totalWindows;
    document.querySelector('#total-tab-count').textContent = counts.totalTabs;
    document.querySelector('#current-window-tab-count').textContent = counts.currentWindowTabs;

    await populateWindowsList();
}

async function populateWindowsList() {
    const windows = await browser.windows.getAll({populate: true});
    const currentWindow = await browser.windows.getCurrent();
    const sleepingWindows = await dataStore.getSleepingWindows();
    const windowsListItems = document.querySelector('#windows-list-items');

    windowsListItems.innerHTML = '';

    // Create window data with titles and sort
    const windowData = [];

    // Add open windows
    for (const window of windows) {
        const windowTitle = await dataStore.getTitleForWindow(window.id);
        const displayTitle = windowTitle || `Window ${window.id}`;
        windowData.push(new WindowData({
            window,
            displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id,
            isSleeping: false
        }));
    }

    // Add sleeping windows
    for (const sleepingWindow of sleepingWindows) {
        windowData.push(new WindowData({
            window: null,
            displayTitle: sleepingWindow.title || `Window ${sleepingWindow.id}`,
            tabCount: sleepingWindow.tabs.length,
            isCurrentWindow: false,
            isSleeping: true,
            sleepingData: sleepingWindow
        }));
    }

    // Sort alphabetically by title, then by tab count (numeric)
    windowData.sort((a, b) => {
        const titleComparison = a.displayTitle.localeCompare(b.displayTitle);
        if (titleComparison !== 0) {
            return titleComparison;
        }
        return a.tabCount - b.tabCount;
    });

    // Create and append list items
    for (const data of windowData) {
        const listItem = document.createElement('li');
        const currentMarker = data.isCurrentWindow ? ' (current)' : '';
        const sleepMarker = data.isSleeping ? ' (sleeping)' : '';

        // Create window info span
        const windowInfo = document.createElement('span');
        windowInfo.className = 'window-info';
        windowInfo.textContent = `${data.displayTitle}: ${data.tabCount} tab${data.tabCount !== 1 ? 's' : ''}${currentMarker}${sleepMarker}`;

        if (data.isCurrentWindow) {
            windowInfo.style.fontWeight = 'bold';
        }

        if (data.isSleeping) {
            windowInfo.style.fontStyle = 'italic';
            windowInfo.style.color = '#666';
        }

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'window-buttons';

        // Add info button for all windows
        const infoButton = document.createElement('button');
        infoButton.className = 'window-btn';
        infoButton.title = 'Show window details';

        const infoIcon = document.createElement('img');
        infoIcon.src = '/icons/read_more.png';
        infoIcon.alt = 'Info';

        infoButton.appendChild(infoIcon);
        infoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showWindowInfo(data);
        });

        buttonContainer.appendChild(infoButton);

        if (data.isSleeping) {
            // For sleeping windows, show wake button instead of sleep button
            const wakeButton = document.createElement('button');
            wakeButton.className = 'window-btn';
            wakeButton.title = 'Wake window';

            const wakeIcon = document.createElement('img');
            wakeIcon.src = '/icons/sunny.png';
            wakeIcon.alt = 'Wake';

            wakeButton.appendChild(wakeIcon);

            // Add click handler for wake button
            wakeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                wakeWindow(data.sleepingData, currentWindow.id);
                // TODO: update the button
            });

            buttonContainer.appendChild(wakeButton);

        } else {
            // For open windows, show sleep button
            const sleepButton = document.createElement('button');
            sleepButton.className = 'window-btn';
            sleepButton.title = 'Sleep window';

            const sleepIcon = document.createElement('img');
            sleepIcon.src = '/icons/bedtime.png';
            sleepIcon.alt = 'Sleep';

            sleepButton.appendChild(sleepIcon);

            // Add click handler for sleep button
            sleepButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // TODO: refresh the info about the window and tabs
                sleepWindow(data);
                // TODO: updated the button
            });

            buttonContainer.appendChild(sleepButton);
        }

        listItem.appendChild(windowInfo);
        listItem.appendChild(buttonContainer);
        windowsListItems.appendChild(listItem);
    }
}

async function exportWindowsData() {
    try {
        console.log('exportWindowsData: Starting export...');

        // Get all open windows
        const windows = await browser.windows.getAll({populate: true});
        console.log('exportWindowsData: Got open windows:', windows.length);

        // Get sleeping windows
        const sleepingWindows = await dataStore.getSleepingWindows();
        console.log('exportWindowsData: Got sleeping windows:', sleepingWindows.length);

        const exportData = {
            timestamp: new Date().toISOString(),
            openWindows: [],
            sleepingWindows: []
        };

        // Process open windows
        for (const window of windows) {
            const windowTitle = await dataStore.getTitleForWindow(window.id);
            const windowData = new WindowData({
                id: window.id,
                title: windowTitle || `Window ${window.id}`,
                state: 'open',
                tabs: window.tabs.map(tab => ({
                    title: tab.title,
                    url: tab.url
                }))
            });
            exportData.openWindows.push(windowData);
        }

        // Process sleeping windows
        for (const sleepingWindow of sleepingWindows) {
            const windowData = new WindowData({
                uuid: sleepingWindow.uuid,
                title: sleepingWindow.title || `Sleeping Window ${sleepingWindow.uuid}`,
                state: 'sleeping',
                sleepTime: sleepingWindow.sleepTime,
                tabs: sleepingWindow.tabs.map(tab => ({
                    title: tab.title,
                    url: tab.url
                }))
            });
            exportData.sleepingWindows.push(windowData);
        }

        console.log('exportWindowsData: Prepared export data');

        // Create and download JSON file
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `kitsune-windows-${timestamp}.json`;

        // Create download link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up
        URL.revokeObjectURL(url);

        console.log('exportWindowsData: Export completed');

    } catch (error) {
        console.error('exportWindowsData: Error during export:', error);
        alert('Error exporting windows data: ' + error.message);
    }
}

window.onload = async () => {

    await refreshManager();

    // Add export button click handler
    document.querySelector('#export-button').addEventListener('click', exportWindowsData);
};
