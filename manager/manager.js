import {WindowData} from '/windowdata.js';
import {getDataStore} from '/datastore.js';

console.debug("manager module-level");

const dataStore = getDataStore();

let sortColumn = 'title';
let sortDirection = 'asc';

function updateSortHeaders() {
    for (const col of ['title', 'tabs', 'status']) {
        const th = document.querySelector(`#sort-${col}`);
        const label = col.charAt(0).toUpperCase() + col.slice(1);
        th.textContent = sortColumn === col
            ? label + (sortDirection === 'asc' ? ' ↑' : ' ↓')
            : label;
    }
}

function setSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    updateSortHeaders();
    populateWindowsList();
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
    detailsContent.appendChild(createDetailRow('Tabs', windowData.tabCount.toString()));

    if (windowData.isCurrentWindow) {
        detailsContent.appendChild(createDetailRow('Current', 'Yes'));
    }

    if (windowData.window) {
        detailsContent.appendChild(createDetailRow('ID', windowData.window.id.toString()));
        if (windowData.window.type) {
            detailsContent.appendChild(createDetailRow('Type', windowData.window.type));
        }
        if (windowData.window.state) {
            detailsContent.appendChild(createDetailRow('State', windowData.window.state));
        }
    }

    // Tabs information
    const tabs = windowData.window?.tabs;
    if (tabs && tabs.length > 0) {
        const tabsTable = document.createElement('table');
        tabsTable.className = 'tabs-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const heading of ['#', 'Title', 'URL', 'Loaded', '']) {
            const th = document.createElement('th');
            th.textContent = heading;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        tabsTable.appendChild(thead);

        const tbody = document.createElement('tbody');
        tabs.forEach((tab, index) => {
            const row = document.createElement('tr');

            const indexCell = document.createElement('td');
            indexCell.textContent = index + 1;
            row.appendChild(indexCell);

            const titleCell = document.createElement('td');
            titleCell.textContent = tab.title || 'Untitled';
            row.appendChild(titleCell);

            const urlCell = document.createElement('td');
            urlCell.textContent = tab.url || '';
            row.appendChild(urlCell);

            const loadedCell = document.createElement('td');
            loadedCell.textContent = tab.discarded ? 'No' : 'Yes';
            row.appendChild(loadedCell);

            const actionsCell = document.createElement('td');
            if (!tab.active) {
                const unloadBtn = document.createElement('button');
                unloadBtn.className = 'window-btn';
                unloadBtn.title = 'Unload tab';
                const icon = document.createElement('img');
                icon.src = '/icons/bedtime.png';
                icon.alt = 'Unload tab';
                unloadBtn.appendChild(icon);
                unloadBtn.addEventListener('click', () => browser.tabs.discard(tab.id));
                actionsCell.appendChild(unloadBtn);
            }
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
        tabsTable.appendChild(tbody);

        detailsContent.appendChild(tabsTable);
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
    const windowsTableBody = document.querySelector('#windows-table-body');

    windowsTableBody.replaceChildren();

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
            if (!windowDatas.includes(wd)) {
                windowDatas.push(wd);
            }
            continue;
        }
        if (!displayTitle) {
            displayTitle = 'Window ' + window.id;
        }
        wd = new WindowData({
            window,
            uuid: uuid,
            id: window.id,
            displayTitle: displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id,
        });
        await dataStore.SetWindowDataForUuid(uuid, wd);
        windowDatas.push(wd);
    }

    await dataStore.SetWindowDatas(windowDatas);

    windowDatas.sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'title') {
            cmp = a.displayTitle.localeCompare(b.displayTitle);
        } else if (sortColumn === 'tabs') {
            cmp = a.tabCount - b.tabCount;
        } else if (sortColumn === 'status') {
            const statusValue = d => d.isCurrentWindow ? 0 : 1;
            cmp = statusValue(a) - statusValue(b);
        }
        return sortDirection === 'asc' ? cmp : -cmp;
    });

    console.debug(windowDatas.length + " window datas");

    for (const data of windowDatas) {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => showWindowInfo(data));

        const titleCell = document.createElement('td');
        titleCell.textContent = data.displayTitle;
        if (data.isCurrentWindow) titleCell.style.fontWeight = 'bold';
        row.appendChild(titleCell);

        const tabsCell = document.createElement('td');
        tabsCell.textContent = data.tabCount;
        row.appendChild(tabsCell);

        const statusCell = document.createElement('td');
        statusCell.textContent = data.isCurrentWindow ? 'Current' : 'Open';
        row.appendChild(statusCell);

        const actionsCell = document.createElement('td');

        {
            const unloadButton = document.createElement('button');
            unloadButton.className = 'window-btn';
            unloadButton.title = 'Unload all tabs';
            const unloadIcon = document.createElement('img');
            unloadIcon.src = '/icons/bedtime.png';
            unloadIcon.alt = 'Unload all tabs';
            unloadButton.appendChild(unloadIcon);
            unloadButton.addEventListener('click', (e) => {
                e.stopPropagation();
                unloadAllTabsInWindow(data.window.id);
            });
            actionsCell.appendChild(unloadButton);
        }

        row.appendChild(actionsCell);

        windowsTableBody.appendChild(row);
    }
}

async function exportWindowsData() {
    try {
        console.debug('exportWindowsData: Starting export...');

        const windows = await browser.windows.getAll({populate: true});
        console.debug('exportWindowsData: Got open windows:', windows.length);

        const exportData = {
            timestamp: new Date().toISOString(),
            windows: []
        };

        for (const window of windows) {
            const windowTitle = await dataStore.getTitleForWindow(window.id);
            exportData.windows.push({
                id: window.id,
                title: windowTitle || `Window ${window.id}`,
                tabs: window.tabs.map(tab => ({
                    title: tab.title,
                    url: tab.url
                }))
            });
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

async function unloadAllTabsInWindow(windowId) {
    const confirmed = confirm(
        'Unloading tabs will discard any unsaved changes (such as text entered in forms).\n\nContinue?'
    );
    if (!confirmed) return;

    const win = await browser.windows.get(windowId, {populate: true});
    const backgroundTabs = win.tabs.filter(tab => !tab.active);
    await browser.tabs.discard(backgroundTabs.map(tab => tab.id));
}

async function unloadAllTabs() {
    const confirmed = confirm(
        'Unloading tabs will discard any unsaved changes (such as text entered in forms).\n\nContinue?'
    );
    if (!confirmed) return;

    const windows = await browser.windows.getAll({populate: true});
    const tabIds = [];
    for (const win of windows) {
        for (const tab of win.tabs) {
            if (!tab.active) tabIds.push(tab.id);
        }
    }
    await browser.tabs.discard(tabIds);
}

async function minimizeAllWindows() {
    const windows = await browser.windows.getAll();

    for (const window of windows) {
        const wid = window.id;
        browser.windows.update(wid, {state: "minimized"})
    }
}

window.onload = async () => {
    document.querySelector('#sort-title').addEventListener('click', () => setSort('title'));
    document.querySelector('#sort-tabs').addEventListener('click', () => setSort('tabs'));
    document.querySelector('#sort-status').addEventListener('click', () => setSort('status'));

    updateSortHeaders();
    await refreshManager();

    document.querySelector('#export-button').addEventListener('click', exportWindowsData);
    document.querySelector('#minimize-all-windows-button').addEventListener('click', minimizeAllWindows);
    document.querySelector('#unload-all-tabs-button').addEventListener('click', unloadAllTabs);
};
