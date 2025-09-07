import {WindowData} from '/windowdata.js';
import {getDataStore} from '/datastore.js';

console.debug("manager module-level");

const dataStore = getDataStore();

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

        console.debug('Window put to sleep with UUID:', uuid, 'Title:', windowData.displayTitle);

        // Refresh the window
        await refreshManager();

    } catch (error) {
        console.error('Error sleeping window:', error);
    }
}

async function wakeWindow(sleepingWindowData, currentWindowId) {
    try {
        console.debug(`wakeWindow(${sleepingWindowData} -> {uuid: ${sleepingWindowData.uuid}, title: ${sleepingWindowData.title}, tabs: ${sleepingWindowData.tabs}, sleepTime: ${sleepingWindowData.sleepTime})`);

        // Send message to background script to handle window creation
        console.debug('wakeWindow, sending message to background script...');

        // Send message without waiting for response to avoid context issues
        browser.runtime.sendMessage({
            action: 'wakeWindow',
            sleepingWindowData: sleepingWindowData,
            currentWindowId: currentWindowId
        }).catch(error => {
            console.error('Message sending failed, but background should still handle it:', error);
        });

        console.debug('wakeWindow, message sent to background script');

    } catch (error) {
        console.error('Error waking window:', error);
    }
}

function showWindowInfo(windowData) {
    const detailsContainer = document.querySelector('#window-details');
    const detailsContent = document.querySelector('#window-details-content');

    // Clear existing content
    detailsContent.replaceChildren();

    // Helper function to create detail rows
    function createDetailRow(label, value) {
        const row = document.createElement('div');
        row.className = 'detail-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'detail-label';
        labelSpan.textContent = label + ':';

        row.appendChild(labelSpan);
        row.appendChild(document.createTextNode(' ' + value));

        return row;
    }

    // Basic window information
    detailsContent.appendChild(createDetailRow('Title', windowData.displayTitle));
    detailsContent.appendChild(createDetailRow('Status', windowData.isSleeping ? 'Sleeping' : 'Open'));
    detailsContent.appendChild(createDetailRow('Tabs', windowData.tabCount.toString()));

    if (windowData.isCurrentWindow) {
        detailsContent.appendChild(createDetailRow('Current', 'Yes'));
    }

    if (windowData.isSleeping && windowData.sleepingData) {
        if (windowData.sleepingData.sleepTime) {
            const sleepDate = new Date(windowData.sleepingData.sleepTime);
            detailsContent.appendChild(createDetailRow('Sleep Time', sleepDate.toLocaleString()));
        }
        if (windowData.sleepingData.uuid) {
            detailsContent.appendChild(createDetailRow('UUID', windowData.sleepingData.uuid));
        }
    }

    if (!windowData.isSleeping && windowData.window) {
        detailsContent.appendChild(createDetailRow('ID', windowData.window.id.toString()));
        if (windowData.window.type) {
            detailsContent.appendChild(createDetailRow('Type', windowData.window.type));
        }
        if (windowData.window.state) {
            detailsContent.appendChild(createDetailRow('State', windowData.window.state));
        }
    }

    // Tabs information
    const tabs = windowData.isSleeping ? windowData.sleepingData?.tabs : windowData.window?.tabs;
    if (tabs && tabs.length > 0) {
        const tabsHeaderRow = document.createElement('div');
        tabsHeaderRow.className = 'detail-row';

        const tabsLabel = document.createElement('span');
        tabsLabel.className = 'detail-label';
        tabsLabel.textContent = 'Tabs:';
        tabsHeaderRow.appendChild(tabsLabel);
        detailsContent.appendChild(tabsHeaderRow);

        const tabsList = document.createElement('div');
        tabsList.className = 'tabs-list';

        tabs.forEach((tab, index) => {
            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item';

            const tabTitle = tab.title || 'Untitled';
            const tabUrl = tab.url || '';

            tabItem.textContent = `${index + 1}. ${tabTitle}`;

            if (tabUrl && tabUrl !== tabTitle) {
                const lineBreak = document.createElement('br');
                tabItem.appendChild(lineBreak);

                const urlText = document.createElement('small');
                urlText.textContent = '\u00A0\u00A0\u00A0' + tabUrl;
                tabItem.appendChild(urlText);
            }

            tabsList.appendChild(tabItem);
        });

        detailsContent.appendChild(tabsList);
    }

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
    const currentWindow = await browser.windows.getCurrent();
    const sleepingWindows = await dataStore.getSleepingWindows();
    const windowsListItems = document.querySelector('#windows-list-items');

    windowsListItems.innerHTML = '';

    // Get stored window data
    const windowDatas = await dataStore.GetWindowDatas();
    console.debug(windowDatas.length + " starting window datas");

    // Add open windows
    const windows = await browser.windows.getAll({populate: true});
    console.debug(windows.length + " open windows");
    for (const window of windows) {
        const uuid = await dataStore.GetUuidForWindow(window.id);
        let wd = await dataStore.GetWindowDataByUuid(uuid);
        let displayTitle = await dataStore.getTitleForWindow(window.id);
        if (wd) {
            if (!wd.displayTitle) {
            }
            if (!windowDatas.includes(wd)) {
                windowDatas.push(wd);
            }
            continue;
        }
        if (displayTitle) {
        } else {
            displayTitle = 'Window ' + window.id
        }
        wd = new WindowData({
            window,
            uuid: uuid,
            id: window.id,
            displayTitle: displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id,
            isSleeping: false
        });
        await dataStore.SetWindowDataForUuid(uuid, wd);
        windowDatas.push(wd);
    }

    // Add sleeping windows
    console.debug(sleepingWindows.length + " sleeping windows");
    for (const sleepingWindow of sleepingWindows) {
        windowDatas.push(new WindowData({
            window: null,
            displayTitle: sleepingWindow.title || `Window ${sleepingWindow.id}`,
            tabCount: sleepingWindow.tabs.length,
            isCurrentWindow: false,
            isSleeping: true,
            sleepingData: sleepingWindow
        }));
    }

    await dataStore.SetWindowDatas(windowDatas);

    // Sort alphabetically by title, then by tab count (numeric)
    console.debug("window datas before sorting: " + windowDatas);
    windowDatas.sort((a, b) => {
        const titleComparison = a.displayTitle.localeCompare(b.displayTitle);
        if (titleComparison !== 0) {
            return titleComparison;
        }
        return a.tabCount - b.tabCount;
    });

    console.debug(windowDatas.length + " window datas");
    const updateWindowInfoSpan = function (windowInfo, data) {
        windowInfo.className = 'window-info';
        const currentMarker = data.isCurrentWindow ? ' (current)' : '';
        const sleepMarker = data.isSleeping ? ' (sleeping)' : '';
        windowInfo.textContent = `${data.displayTitle}: ${data.tabCount} tab${data.tabCount !== 1 ? 's' : ''}${currentMarker}${sleepMarker}`;

        if (data.isCurrentWindow) {
            windowInfo.style.fontWeight = 'bold';
        } else {
            windowInfo.style.fontWeight = null;
            console.debug("isCurrentWindow font weight: " + windowInfo.style.fontWeight)
        }

        if (data.isSleeping) {
            windowInfo.style.fontStyle = 'italic';
            windowInfo.style.color = '#666';
        } else {
            windowInfo.style.fontStyle = null;
            windowInfo.style.color = null;
            console.debug("isSleeping font style: " + windowInfo.style.fontStyle)
            console.debug("isSleeping font color: " + windowInfo.style.color)
        }
    }

    // Create and append list items
    for (const data of windowDatas) {

        const listItem = document.createElement('li');

        // Create window info span
        const windowInfo = document.createElement('span');
        updateWindowInfoSpan(windowInfo, data);

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

        // const sleepWakeButton = document.createElement('button');
        // sleepWakeButton.className = 'window-btn';
        // const sleepWakeIcon = document.createElement('img');
        // const setSleepWakeButton = function (_data) {
        //     console.debug('setSleepWakeButton, data.isSleeping: ' + _data.isSleeping);
        //     if (_data.isSleeping) {
        //         sleepWakeButton.title = 'Wake window';
        //         sleepWakeIcon.src = '/icons/sunny.png';
        //         sleepWakeIcon.alt = 'Wake';
        //     } else {
        //         sleepWakeButton.title = 'Sleep window';
        //         sleepWakeIcon.src = '/icons/bedtime.png';
        //         sleepWakeIcon.alt = 'Sleep';
        //     }
        // }
        // setSleepWakeButton(data);
        // sleepWakeButton.appendChild(sleepWakeIcon);
        // sleepWakeButton.addEventListener('click', (e) => {
        //     e.stopPropagation();
        //     if (data.isSleeping) {
        //         wakeWindow(data.sleepingData, currentWindow.id);
        //     } else {
        //         // TODO: refresh the info about the window and tabs
        //         sleepWindow(data);
        //     }
        //     data.isSleeping = !data.isSleeping;
        //     setSleepWakeButton(data);
        //     updateWindowInfoSpan(windowInfo, data);
        // });
        // buttonContainer.appendChild(sleepWakeButton);

        listItem.appendChild(windowInfo);
        listItem.appendChild(buttonContainer);
        windowsListItems.appendChild(listItem);
    }
}

async function exportWindowsData() {
    try {
        console.debug('exportWindowsData: Starting export...');

        // Get all open windows
        const windows = await browser.windows.getAll({populate: true});
        console.debug('exportWindowsData: Got open windows:', windows.length);

        // Get sleeping windows
        const sleepingWindows = await dataStore.getSleepingWindows();
        console.debug('exportWindowsData: Got sleeping windows:', sleepingWindows.length);

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

        console.debug('exportWindowsData: Prepared export data');

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

        console.debug('exportWindowsData: Export completed');

    } catch (error) {
        console.error('exportWindowsData: Error during export:', error);
        alert('Error exporting windows data: ' + error.message);
    }
}

async function minimizeAllWindows() {
    const windows = await browser.windows.getAll();

    for (const window of windows) {
        const wid = window.id;
        browser.windows.update(wid, {state: "minimized"})
    }
}

window.onload = async () => {

    await refreshManager();

    // Add export button click handler
    document.querySelector('#export-button').addEventListener('click', exportWindowsData);
    document.querySelector('#minimize-all-windows-button').addEventListener('click', minimizeAllWindows);
};
