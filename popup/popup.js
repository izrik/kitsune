import {DataStore, refreshAppearanceForWindow} from '/kitsune.js';

const dataStore = new DataStore();

async function getCurrentWindowTitle() {
    const currentWindow = await window.browser.windows.getCurrent();
    const currentWindowTitle = await dataStore.getTitleForWindow(currentWindow.id);

    return currentWindowTitle;
}

async function setWindowTitle(title) {
    console.log(`setWindowTitle("${title}")`);
    const currentWindow = await window.browser.windows.getCurrent();
    await dataStore.saveTitleForWindow(currentWindow.id, title);
    await refreshAppearanceForWindow(currentWindow.id);
}

async function getWindowAndTabCounts() {
    const windows = await browser.windows.getAll({populate: true});
    const currentWindow = await browser.windows.getCurrent({populate: true});

    const totalWindows = windows.length;
    const totalTabs = windows.reduce((sum, window) => sum + window.tabs.length, 0);
    const currentWindowTabs = currentWindow.tabs.length;

    return {
        totalWindows,
        totalTabs,
        currentWindowTabs
    };
}

async function populateWindowsList() {
    const windows = await browser.windows.getAll({populate: true});
    const currentWindow = await browser.windows.getCurrent();
    const windowsListItems = document.querySelector('#windows-list-items');

    windowsListItems.innerHTML = '';

    // Create window data with titles and sort
    const windowData = [];
    for (const window of windows) {
        const windowTitle = await dataStore.getTitleForWindow(window.id);
        const displayTitle = windowTitle || `Window ${window.id}`;
        windowData.push({
            window,
            displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id
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

        listItem.textContent = `${data.displayTitle}: ${data.tabCount} tab${data.tabCount !== 1 ? 's' : ''}${currentMarker}`;

        if (data.isCurrentWindow) {
            listItem.style.fontWeight = 'bold';
        }

        windowsListItems.appendChild(listItem);
    }
}

document.querySelector('#popup-form').addEventListener('submit', async (e) => {
    console.log('popup form submitted');
    e.preventDefault();
    const userWindowTitle = document.querySelector('#user-window-title-input').value;
    console.log(`Got window title: ${userWindowTitle}`)
    await setWindowTitle(userWindowTitle);
    console.log("Set window title. Now closing the popup.")
    window.close();
})

window.onload = async () => {
    const currentWindowTitle = await getCurrentWindowTitle();
    const userWindowTitleInput = document.querySelector('#user-window-title-input');
    userWindowTitleInput.value = currentWindowTitle;
    userWindowTitleInput.select();

    const counts = await getWindowAndTabCounts();
    document.querySelector('#window-count').textContent = counts.totalWindows;
    document.querySelector('#total-tab-count').textContent = counts.totalTabs;
    document.querySelector('#current-window-tab-count').textContent = counts.currentWindowTabs;

    await populateWindowsList();
};
