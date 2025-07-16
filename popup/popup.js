import {DataStore, refreshAppearanceForWindow} from '/kitsune.js';

const dataStore = new DataStore();

async function getCurrentWindowTitle() {
    const currentWindow = await window.browser.windows.getCurrent();
    const currentWindowTitle = await dataStore.getTitleForWindow(currentWindow.id);

    return currentWindowTitle;
}

async function setWindowTitle(title, windowId) {
    console.log(`setWindowTitle("${title}", "${windowId}")`);
    await dataStore.saveTitleForWindow(windowId, title);
    await refreshAppearanceForWindow(windowId);
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
        // Store window state
        const windowState = {
            originalWindowId: windowData.window.id,
            title: windowData.displayTitle,
            tabs: windowData.window.tabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl
            }))
        };

        const uuid = await dataStore.saveSleepingWindow(windowState);

        // Close the window
        await browser.windows.remove(windowData.window.id);

        console.log('Window put to sleep with UUID:', uuid, 'Title:', windowData.displayTitle);

        // Refresh the popup
        await refreshPopup();

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

        // Close the popup after a brief delay to ensure message is sent
        setTimeout(() => window.close(), 50);

    } catch (error) {
        console.error('Error waking window:', error);
    }
}

async function refreshPopup() {
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
        windowData.push({
            window,
            displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id,
            isSleeping: false
        });
    }

    // Add sleeping windows
    for (const sleepingWindow of sleepingWindows) {
        windowData.push({
            window: null,
            displayTitle: sleepingWindow.title || `Window ${sleepingWindow.id}`,
            tabCount: sleepingWindow.tabs.length,
            isCurrentWindow: false,
            isSleeping: true,
            sleepingData: sleepingWindow
        });
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
                sleepWindow(data);
            });

            // // Create close button
            // const closeButton = document.createElement('button');
            // closeButton.className = 'window-btn';
            // closeButton.title = 'Close window';
            //
            // const closeIcon = document.createElement('img');
            // closeIcon.src = '/icons/close.png';
            // closeIcon.alt = 'Close';
            //
            // closeButton.appendChild(closeIcon);
            //
            // // Add click handler for close button
            // closeButton.addEventListener('click', (e) => {
            //     e.stopPropagation();
            //     browser.windows.remove(data.window.id);
            //     setTimeout(refreshPopup, 100); // Refresh after a short delay
            // });

            buttonContainer.appendChild(sleepButton);
            // buttonContainer.appendChild(closeButton);
        }

        listItem.appendChild(windowInfo);
        listItem.appendChild(buttonContainer);
        windowsListItems.appendChild(listItem);
    }
}

document.querySelector('#popup-form').addEventListener('submit', async (e) => {
    console.log('popup form submitted');
    e.preventDefault();
    const userWindowTitle = document.querySelector('#user-window-title-input').value;
    console.log(`Got window title: ${userWindowTitle}`)
    const currentWindow = await window.browser.windows.getCurrent();
    await setWindowTitle(userWindowTitle, currentWindow.id);
    console.log("Set window title. Now closing the popup.")
    window.close();
})

window.onload = async () => {
    const currentWindowTitle = await getCurrentWindowTitle();
    const userWindowTitleInput = document.querySelector('#user-window-title-input');
    userWindowTitleInput.value = currentWindowTitle;
    userWindowTitleInput.select();

    const currentWindow = await window.browser.windows.getCurrent();
    document.querySelector('#window-id').textContent = currentWindow.id;
    let uuid = await dataStore.GetUuidForWindow(currentWindow.id)
    document.querySelector('#window-uuid').textContent = uuid;
    document.querySelector('#window-log').textContent = await dataStore.GetLogForWindow(currentWindow.id);

    await refreshPopup();
};
