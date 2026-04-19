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

    detailsContent.appendChild(createDetailRow('ID', windowData.window.id.toString()));
    if (windowData.window.type) {
        detailsContent.appendChild(createDetailRow('Type', windowData.window.type));
    }
    if (windowData.window.state) {
        detailsContent.appendChild(createDetailRow('State', windowData.window.state));
    }

    // Tabs information
    const tabs = windowData.window.tabs;
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

            const pinBtn = document.createElement('button');
            pinBtn.className = 'window-btn';
            pinBtn.title = tab.pinned ? 'Unpin tab' : 'Pin tab';
            const pinIcon = document.createElement('img');
            pinIcon.src = tab.pinned ? '/icons/keep_off.png' : '/icons/keep.png';
            pinIcon.alt = tab.pinned ? 'Unpin tab' : 'Pin tab';
            pinBtn.appendChild(pinIcon);
            pinBtn.addEventListener('click', () => browser.tabs.update(tab.id, {pinned: !tab.pinned}));
            actionsCell.appendChild(pinBtn);

            const muteBtn = document.createElement('button');
            muteBtn.className = 'window-btn';
            const isMuted = tab.mutedInfo?.muted;
            muteBtn.title = isMuted ? 'Unmute tab' : 'Mute tab';
            const muteIcon = document.createElement('img');
            muteIcon.src = isMuted ? '/icons/volume_up.png' : '/icons/no_sound.png';
            muteIcon.alt = isMuted ? 'Unmute tab' : 'Mute tab';
            muteBtn.appendChild(muteIcon);
            muteBtn.addEventListener('click', () => browser.tabs.update(tab.id, {muted: !isMuted}));
            actionsCell.appendChild(muteBtn);

            const switchBtn = document.createElement('button');
            switchBtn.className = 'window-btn';
            switchBtn.title = 'Switch to tab';
            const switchIcon = document.createElement('img');
            switchIcon.src = '/icons/read_more.png';
            switchIcon.alt = 'Switch to tab';
            switchBtn.appendChild(switchIcon);
            switchBtn.addEventListener('click', async () => {
                await browser.tabs.update(tab.id, {active: true});
                await browser.windows.update(windowData.window.id, {focused: true});
            });
            actionsCell.appendChild(switchBtn);

            const unloadBtn = document.createElement('button');
            unloadBtn.className = 'window-btn';
            unloadBtn.title = 'Unload tab';
            unloadBtn.disabled = tab.active;
            const unloadIcon = document.createElement('img');
            unloadIcon.src = '/icons/bedtime.png';
            unloadIcon.alt = 'Unload tab';
            unloadIcon.style.opacity = tab.active ? '0.3' : '1';
            unloadBtn.appendChild(unloadIcon);
            if (!tab.active) {
                unloadBtn.addEventListener('click', () => browser.tabs.discard(tab.id));
            }
            actionsCell.appendChild(unloadBtn);

            const moveBtn = document.createElement('button');
            moveBtn.className = 'window-btn';
            moveBtn.title = 'Move to new window';
            const moveIcon = document.createElement('img');
            moveIcon.src = '/icons/open_in_new.png';
            moveIcon.alt = 'Move to new window';
            moveBtn.appendChild(moveIcon);
            moveBtn.addEventListener('click', () => browser.windows.create({tabId: tab.id}));
            actionsCell.appendChild(moveBtn);

            const dupBtn = document.createElement('button');
            dupBtn.className = 'window-btn';
            dupBtn.title = 'Duplicate tab';
            const dupIcon = document.createElement('img');
            dupIcon.src = '/icons/tab_duplicate.png';
            dupIcon.alt = 'Duplicate tab';
            dupBtn.appendChild(dupIcon);
            dupBtn.addEventListener('click', () => browser.tabs.duplicate(tab.id));
            actionsCell.appendChild(dupBtn);

            const closeTabBtn = document.createElement('button');
            closeTabBtn.className = 'window-btn';
            closeTabBtn.title = 'Close tab';
            const closeTabIcon = document.createElement('img');
            closeTabIcon.src = '/icons/close.png';
            closeTabIcon.alt = 'Close tab';
            closeTabBtn.appendChild(closeTabIcon);
            closeTabBtn.addEventListener('click', () => browser.tabs.remove(tab.id));
            actionsCell.appendChild(closeTabBtn);

            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
        tabsTable.appendChild(tbody);

        detailsContent.appendChild(tabsTable);
    }

    detailsContainer.classList.add('visible');
}

async function populateWindowsList() {
    const currentWindow = await browser.windows.getCurrent();
    const windowsTableBody = document.querySelector('#windows-table-body');

    windowsTableBody.replaceChildren();

    const windows = await browser.windows.getAll({populate: true});
    const totalTabs = windows.reduce((sum, w) => sum + w.tabs.length, 0);
    const currentWindowTabs = windows.find(w => w.id === currentWindow.id)?.tabs.length ?? 0;

    document.querySelector('#window-count').textContent = windows.length;
    document.querySelector('#total-tab-count').textContent = totalTabs;
    document.querySelector('#current-window-tab-count').textContent = currentWindowTabs;

    const windowDatas = [];
    for (const window of windows) {
        let displayTitle = await dataStore.getTitleForWindow(window.id);
        if (!displayTitle) {
            displayTitle = 'Window ' + window.id;
        }
        windowDatas.push({
            window,
            displayTitle,
            tabCount: window.tabs.length,
            isCurrentWindow: window.id === currentWindow.id,
        });
    }

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

        const switchButton = document.createElement('button');
        switchButton.className = 'window-btn';
        switchButton.title = 'Switch to window';
        const switchIcon = document.createElement('img');
        switchIcon.src = '/icons/read_more.png';
        switchIcon.alt = 'Switch to window';
        switchButton.appendChild(switchIcon);
        switchButton.addEventListener('click', (e) => {
            e.stopPropagation();
            browser.windows.update(data.window.id, {focused: true});
        });
        actionsCell.appendChild(switchButton);

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

        const reloadButton = document.createElement('button');
        reloadButton.className = 'window-btn';
        reloadButton.title = 'Reload all tabs';
        const reloadIcon = document.createElement('img');
        reloadIcon.src = '/icons/refresh.png';
        reloadIcon.alt = 'Reload all tabs';
        reloadButton.appendChild(reloadIcon);
        reloadButton.addEventListener('click', (e) => {
            e.stopPropagation();
            reloadAllTabsInWindow(data.window.id);
        });
        actionsCell.appendChild(reloadButton);

        const closeWindowButton = document.createElement('button');
        closeWindowButton.className = 'window-btn';
        closeWindowButton.title = 'Close window';
        const closeWindowIcon = document.createElement('img');
        closeWindowIcon.src = '/icons/close.png';
        closeWindowIcon.alt = 'Close window';
        closeWindowButton.appendChild(closeWindowIcon);
        closeWindowButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const confirmed = confirm(
                `Close window "${data.displayTitle}" and all its tabs?\n\nThis can be undone from History > Recently Closed Windows.`
            );
            if (confirmed) browser.windows.remove(data.window.id);
        });
        actionsCell.appendChild(closeWindowButton);

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

async function reloadAllTabsInWindow(windowId) {
    const win = await browser.windows.get(windowId, {populate: true});
    for (const tab of win.tabs) {
        browser.tabs.reload(tab.id);
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
    const tabIds = windows.flatMap(w => w.tabs.filter(t => !t.active).map(t => t.id));
    await browser.tabs.discard(tabIds);
}

async function refreshAppearanceForAllWindows() {
    const windows = await browser.windows.getAll();
    for (const window of windows) {
        await dataStore.refreshAppearanceForWindow(window.id);
    }
}

async function minimizeAllWindows() {
    const windows = await browser.windows.getAll();
    for (const window of windows) {
        browser.windows.update(window.id, {state: "minimized"});
    }
}

window.onload = async () => {
    document.querySelector('#sort-title').addEventListener('click', () => setSort('title'));
    document.querySelector('#sort-tabs').addEventListener('click', () => setSort('tabs'));
    document.querySelector('#sort-status').addEventListener('click', () => setSort('status'));

    updateSortHeaders();
    await populateWindowsList();

    document.querySelector('#export-button').addEventListener('click', exportWindowsData);
    document.querySelector('#minimize-all-windows-button').addEventListener('click', minimizeAllWindows);
    document.querySelector('#unload-all-tabs-button').addEventListener('click', unloadAllTabs);
    document.querySelector('#refresh-appearance-button').addEventListener('click', refreshAppearanceForAllWindows);
};
