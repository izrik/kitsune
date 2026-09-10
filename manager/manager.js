import {getDataStore} from '/datastore.js';

console.debug("manager module-level");

const dataStore = getDataStore();

let sortColumn = 'title';
let sortDirection = 'asc';
let selectedWindowId = null;
let refreshTimer = null;
let importing = false;
// The windows and titles from the last refresh, reused by showWindowInfo so that
// opening a window's details does not re-query every window all over again.
let lastWindowDatas = [];
// Set while a window title is being edited inline, so a refresh cannot rebuild the
// table out from under the input.
let editingWindowId = null;

const REFRESH_DEBOUNCE_MS = 500;

// The action buttons all operate on "every window as it is right now", which is not a
// stable idea while an import is creating windows: windows.getAll() would snapshot a
// moving target, half-applying the action, and confirm() would block the import loop
// outright. Import re-entry is the worst of them - two concurrent imports interleave
// and the first to finish clears `importing` while the other is still running.
function setActionsEnabled(enabled) {
    for (const button of document.querySelectorAll('#actions-toolbar .action-btn')) {
        button.disabled = !enabled;
    }
}

function scheduleRefresh() {
    // An import fires tabs.onCreated once per tab. Rebuilding the list thousands of
    // times mid-import is pure waste; it is refreshed once when the import finishes.
    if (importing) return;
    // A refresh rebuilds the whole table, which would tear out an in-progress inline
    // title edit along with whatever has been typed into it.
    if (editingWindowId !== null) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(populateWindowsList, REFRESH_DEBOUNCE_MS);
}

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

async function showWindowInfo(windowData) {
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

    const currentBadge = document.createElement('span');
    currentBadge.className = windowData.isCurrentWindow ? 'status-badge current' : 'status-badge open';
    currentBadge.textContent = windowData.isCurrentWindow ? 'Yes' : 'No';
    const currentRow = document.createElement('div');
    currentRow.className = 'detail-row';
    const currentLabel = document.createElement('span');
    currentLabel.className = 'detail-label';
    currentLabel.textContent = 'Current:';
    currentRow.appendChild(currentLabel);
    currentRow.appendChild(currentBadge);
    detailsContent.appendChild(currentRow);

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

        const selectAllTh = document.createElement('th');
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllTh.appendChild(selectAllCheckbox);
        headerRow.appendChild(selectAllTh);

        for (const heading of ['#', 'Title', 'URL', '', '']) {
            const th = document.createElement('th');
            th.textContent = heading;
            headerRow.appendChild(th);
        }
        // Give the loaded-dot column a tooltip header
        headerRow.children[4].title = 'Loaded (green) / Unloaded (gray)';
        thead.appendChild(headerRow);
        tabsTable.appendChild(thead);

        // Bulk action bar
        const bulkBar = document.createElement('div');
        bulkBar.className = 'bulk-action-bar';

        const bulkLabel = document.createElement('span');
        bulkBar.appendChild(bulkLabel);

        const bulkCloseBtn = document.createElement('button');
        bulkCloseBtn.textContent = 'Close selected';
        bulkBar.appendChild(bulkCloseBtn);

        const bulkMoveLabel = document.createElement('label');
        bulkMoveLabel.textContent = 'Move to: ';
        const bulkMoveSelect = document.createElement('select');
        bulkMoveLabel.appendChild(bulkMoveSelect);
        bulkBar.appendChild(bulkMoveLabel);

        const bulkMoveBtn = document.createElement('button');
        bulkMoveBtn.textContent = 'Move';
        bulkBar.appendChild(bulkMoveBtn);

        // Reuse the titles from the last list refresh. Querying them again here meant a
        // second windows.getAll() plus another sessions read per window, doubling the
        // cost of every refresh whenever a window was selected.
        const otherWindowOptions = lastWindowDatas
            .filter(d => d.window.id !== windowData.window.id)
            .map(d => ({id: d.window.id, label: d.displayTitle}));

        for (const opt of otherWindowOptions) {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.label;
            bulkMoveSelect.appendChild(option);
        }

        function getCheckedTabIds() {
            return [...tbody.querySelectorAll('input[type=checkbox]:checked')]
                .map(cb => parseInt(cb.dataset.tabId));
        }

        function updateBulkBar() {
            const checked = getCheckedTabIds();
            const visible = checked.length > 0;
            bulkBar.classList.toggle('visible', visible);
            bulkLabel.textContent = `${checked.length} tab${checked.length !== 1 ? 's' : ''} selected`;
            selectAllCheckbox.checked = checked.length === tabs.length;
            selectAllCheckbox.indeterminate = checked.length > 0 && checked.length < tabs.length;
        }

        selectAllCheckbox.addEventListener('change', () => {
            tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
            });
            updateBulkBar();
        });

        bulkCloseBtn.addEventListener('click', async () => {
            const ids = getCheckedTabIds();
            if (!confirm(`Close ${ids.length} tab${ids.length !== 1 ? 's' : ''}?`)) return;
            await browser.tabs.remove(ids);
        });

        bulkMoveBtn.addEventListener('click', async () => {
            const targetWindowId = parseInt(bulkMoveSelect.value);
            if (!targetWindowId) return;
            await browser.tabs.move(getCheckedTabIds(), {windowId: targetWindowId, index: -1});
        });

        const tbody = document.createElement('tbody');
        tabs.forEach((tab, index) => {
            const row = document.createElement('tr');
            if (tab.discarded) row.classList.add('tab-unloaded');

            const checkCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.tabId = tab.id;
            checkbox.addEventListener('change', updateBulkBar);
            checkCell.appendChild(checkbox);
            row.appendChild(checkCell);

            const indexCell = document.createElement('td');
            indexCell.textContent = index + 1;
            row.appendChild(indexCell);

            const titleCell = document.createElement('td');
            const titleInner = document.createElement('div');
            titleInner.style.display = 'flex';
            titleInner.style.alignItems = 'center';
            titleInner.style.gap = '4px';
            if (tab.favIconUrl) {
                const favicon = document.createElement('img');
                favicon.src = tab.favIconUrl;
                favicon.style.width = '16px';
                favicon.style.height = '16px';
                favicon.style.flexShrink = '0';
                favicon.onerror = () => favicon.remove();
                titleInner.appendChild(favicon);
            }
            const titleText = document.createElement('span');
            titleText.textContent = tab.title || 'Untitled';
            titleText.style.overflow = 'hidden';
            titleText.style.textOverflow = 'ellipsis';
            titleText.style.whiteSpace = 'nowrap';
            titleInner.appendChild(titleText);
            titleCell.appendChild(titleInner);
            row.appendChild(titleCell);

            const urlCell = document.createElement('td');
            urlCell.textContent = tab.url || '';
            row.appendChild(urlCell);

            const loadedCell = document.createElement('td');
            const loadedDot = document.createElement('span');
            loadedDot.className = tab.discarded ? 'loaded-dot no' : 'loaded-dot yes';
            loadedDot.title = tab.discarded ? 'Unloaded' : 'Loaded';
            loadedCell.appendChild(loadedDot);
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

            if (otherWindowOptions.length > 0) {
                const moveSelect = document.createElement('select');
                moveSelect.className = 'move-to-select';
                moveSelect.title = 'Move to window';
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Move to…';
                placeholder.disabled = true;
                placeholder.selected = true;
                moveSelect.appendChild(placeholder);
                for (const opt of otherWindowOptions) {
                    const option = document.createElement('option');
                    option.value = opt.id;
                    option.textContent = opt.label;
                    moveSelect.appendChild(option);
                }
                moveSelect.addEventListener('change', async () => {
                    const targetWindowId = parseInt(moveSelect.value);
                    if (targetWindowId) {
                        await browser.tabs.move(tab.id, {windowId: targetWindowId, index: -1});
                    }
                });
                actionsCell.appendChild(moveSelect);
            }

            const dupBtn = document.createElement('button');
            dupBtn.className = 'window-btn';
            dupBtn.title = 'Duplicate tab';
            const dupIcon = document.createElement('img');
            dupIcon.src = '/icons/tab_duplicate.png';
            dupIcon.alt = 'Duplicate tab';
            dupBtn.appendChild(dupIcon);
            dupBtn.addEventListener('click', async () => {
                const newTab = await browser.tabs.duplicate(tab.id);
                await browser.tabs.move(newTab.id, {index: tab.index + 1});
            });
            actionsCell.appendChild(dupBtn);

            const reloadTabBtn = document.createElement('button');
            reloadTabBtn.className = 'window-btn';
            reloadTabBtn.title = 'Reload tab';
            const reloadTabIcon = document.createElement('img');
            reloadTabIcon.src = '/icons/refresh.png';
            reloadTabIcon.alt = 'Reload tab';
            reloadTabBtn.appendChild(reloadTabIcon);
            reloadTabBtn.addEventListener('click', () => browser.tabs.reload(tab.id));
            actionsCell.appendChild(reloadTabBtn);

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
        detailsContent.appendChild(bulkBar);
    }

    selectedWindowId = windowData.window.id;
    document.querySelector('#window-details-placeholder').style.display = 'none';
    detailsContainer.classList.add('visible');
    detailsContainer.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function hideWindowInfo() {
    selectedWindowId = null;
    document.querySelector('#window-details').classList.remove('visible');
    document.querySelector('#window-details-placeholder').style.display = '';
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

    // One sessions round trip per window, issued together rather than one after another.
    // Serially this dominated the cost of a refresh: a few hundred windows meant a few
    // hundred sequential IPC calls, repeated on every tab event.
    const storedTitles = await Promise.all(windows.map(w => dataStore.getTitleForWindow(w.id)));

    const windowDatas = windows.map((window, i) => ({
        window,
        displayTitle: storedTitles[i] || 'Window ' + window.id,
        storedTitle: storedTitles[i] || '',
        tabCount: window.tabs.length,
        isCurrentWindow: window.id === currentWindow.id,
    }));
    lastWindowDatas = windowDatas;

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

    if (selectedWindowId !== null) {
        const selected = windowDatas.find(d => d.window.id === selectedWindowId);
        if (selected) {
            showWindowInfo(selected);
        } else {
            hideWindowInfo();
        }
    }

    for (const data of windowDatas) {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        if (data.window.id === selectedWindowId) row.classList.add('selected');
        row.addEventListener('click', () => {
            document.querySelectorAll('#windows-table-body tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            showWindowInfo(data);
        });

        const titleCell = document.createElement('td');
        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'title-cell';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = data.displayTitle;
        titleSpan.title = 'Click to edit';
        titleSpan.style.cursor = 'text';
        if (data.isCurrentWindow) titleSpan.style.fontWeight = 'bold';
        const editIcon = document.createElement('img');
        editIcon.src = '/icons/edit.png';
        editIcon.className = 'title-edit-icon';
        editIcon.alt = '';
        titleWrapper.appendChild(titleSpan);
        titleWrapper.appendChild(editIcon);
        titleCell.appendChild(titleWrapper);

        titleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = data.storedTitle;
            input.className = 'title-edit-input';
            input.placeholder = 'Window name…';
            titleCell.replaceChildren(input);
            input.focus();
            input.select();
            editingWindowId = data.window.id;
            let committed = false;
            async function commit() {
                if (committed) return;
                committed = true;
                editingWindowId = null;
                const newTitle = input.value.trim();
                await dataStore.saveTitleForWindow(data.window.id, newTitle);
                await dataStore.refreshAppearanceForWindow(data.window.id);
                scheduleRefresh();
            }
            function cancel() {
                if (committed) return;
                committed = true;
                editingWindowId = null;
                titleCell.replaceChildren(titleSpan);
            }
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { cancel(); }
            });
            input.addEventListener('blur', commit);
        });
        row.appendChild(titleCell);

        const tabsCell = document.createElement('td');
        const tabsBadge = document.createElement('span');
        tabsBadge.className = 'tab-count-badge';
        tabsBadge.textContent = data.tabCount;
        tabsCell.appendChild(tabsBadge);
        row.appendChild(tabsCell);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = data.isCurrentWindow ? 'status-badge current' : 'status-badge open';
        statusBadge.textContent = data.isCurrentWindow ? 'Current' : 'Open';
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const actionsCell = document.createElement('td');

        const newTabButton = document.createElement('button');
        newTabButton.className = 'window-btn';
        newTabButton.title = 'New tab';
        const newTabIcon = document.createElement('img');
        newTabIcon.src = '/icons/new_window.png';
        newTabIcon.alt = 'New tab';
        newTabButton.appendChild(newTabIcon);
        newTabButton.addEventListener('click', (e) => {
            e.stopPropagation();
            browser.tabs.create({windowId: data.window.id});
        });
        actionsCell.appendChild(newTabButton);

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

// Exports made before the sleep/wake feature was removed split windows into
// openWindows and sleepingWindows instead of a single windows array. The sleeping
// distinction is gone, but the windows under it are still worth importing, and the
// fields we read (title, tabs[].url) are identical in both shapes.
function windowsFromImportData(data) {
    if (Array.isArray(data.windows)) return data.windows;

    const legacy = ['openWindows', 'sleepingWindows'].filter(k => Array.isArray(data[k]));
    if (legacy.length > 0) return legacy.flatMap(k => data[k]);

    return null;
}

// Import safety valve: if this many tabs refuse to be created unloaded, something is
// wrong with the API rather than with individual URLs, and continuing would load every
// remaining tab at once. Stop instead.
const LOADED_FALLBACK_LIMIT = 20;
const LARGE_IMPORT_WINDOWS = 25;

// Thrown only for conditions that should stop the whole import, so that the per-window
// error handling can tell them apart from one window failing to open.
class ImportAbort extends Error {}

// Firefox refuses to open privileged URLs from an extension - it rejects them with
// "Illegal URL" - and there is no way around it. Exports are full of them (about:home
// and about:newtab especially), so they are skipped and counted rather than treated as
// errors. about:blank is the one about: page extensions may open.
const PRIVILEGED_SCHEMES = ['chrome:', 'javascript:', 'data:', 'file:'];

function isRestorableUrl(url) {
    if (!url) return false;
    const scheme = url.slice(0, url.indexOf(':') + 1).toLowerCase();
    if (scheme === 'about:') return url.split(/[?#]/)[0].toLowerCase() === 'about:blank';
    return !PRIVILEGED_SCHEMES.includes(scheme);
}

// Firefox accepts `title` only on a tab created with `discarded: true` - which is what
// keeps the tab strip readable when nothing has loaded yet. A URL that refuses to be
// created discarded (privileged pages, mainly) is retried as a normal tab.
async function createImportedTabs(windowId, tabs, onTabDone) {
    let loadedFallbacks = 0;
    const failures = [];

    for (const [i, tab] of tabs.entries()) {
        const props = {windowId, url: tab.url, active: false, index: i + 1};
        try {
            await browser.tabs.create({
                ...props,
                discarded: true,
                ...(tab.title ? {title: tab.title} : {}),
            });
        } catch (e) {
            console.debug(`createImportedTabs: could not discard ${tab.url}:`, e);
            if (++loadedFallbacks > LOADED_FALLBACK_LIMIT) {
                throw new ImportAbort(
                    `${loadedFallbacks} tabs could not be created in an unloaded state. ` +
                    'Stopping rather than loading every remaining tab at once.'
                );
            }
            try {
                await browser.tabs.create(props);
            } catch (e2) {
                console.debug(`createImportedTabs: could not create ${tab.url}:`, e2);
                failures.push(tab.url);
            }
        }
        onTabDone?.();
    }

    return failures;
}

async function importWindowsData(file) {
    if (importing) return;

    let data;
    try {
        data = JSON.parse(await file.text());
    } catch (e) {
        alert('Error reading import file: ' + e.message);
        return;
    }

    const importedWindows = windowsFromImportData(data);
    if (!importedWindows) {
        alert('Invalid import file: no windows found.');
        return;
    }

    const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

    // Work out what is actually openable before touching the browser, so the counts in
    // the confirm dialog are the counts the user will get.
    const plans = importedWindows
        .map(w => {
            const tabs = (w.tabs ?? []).filter(t => t.url);
            return {
                title: w.title || '',
                restorable: tabs.filter(t => isRestorableUrl(t.url)),
                skipped: tabs.filter(t => !isRestorableUrl(t.url)).map(t => t.url),
            };
        })
        .filter(plan => plan.restorable.length > 0 || plan.skipped.length > 0);

    if (plans.length === 0) {
        alert('No importable windows found in file.');
        return;
    }

    const tabCount = plans.reduce((sum, plan) => sum + plan.restorable.length, 0);
    const skipped = plans.flatMap(plan => plan.skipped);

    const notes = [];
    if (skipped.length > 0) {
        notes.push(
            `${plural(skipped.length, 'tab')} cannot be reopened by an extension ` +
            '(privileged pages such as about:home, and local files) and will be skipped.'
        );
    }
    if (plans.length > LARGE_IMPORT_WINDOWS) {
        notes.push(
            'Tabs are created unloaded, so they will not all load at once, but this ' +
            'many windows will still take a while to open.'
        );
    }
    const note = notes.length > 0 ? '\n\n' + notes.join('\n\n') : '';

    if (!confirm(`Open ${plural(plans.length, 'window')} with ${plural(tabCount, 'tab')}?${note}`)) return;

    const status = document.querySelector('#import-status');
    let windowsDone = 0;
    let tabsDone = 0;
    const failures = [];
    const windowFailures = [];
    const showProgress = () => {
        status.textContent =
            `Importing… ${plural(windowsDone, 'window')} of ${plans.length}, ` +
            `${tabsDone} of ${tabCount} tabs`;
    };

    importing = true;
    setActionsEnabled(false);
    status.hidden = false;
    showProgress();

    try {
        for (const plan of plans) {
            try {
                // windows.create always loads what it opens, so the seed tab is the one
                // tab per window that cannot be avoided loading. A window with nothing
                // restorable still gets created - its title is worth keeping - and
                // omitting url opens the new tab page.
                const seed = plan.restorable[0];
                const newWindow = await browser.windows.create(seed ? {url: seed.url} : {});
                if (seed) {
                    tabsDone++;
                    showProgress();
                }

                failures.push(...await createImportedTabs(newWindow.id, plan.restorable.slice(1), () => {
                    tabsDone++;
                    showProgress();
                }));

                if (plan.title && !/^Window \d+$/.test(plan.title)) {
                    await dataStore.saveTitleForWindow(newWindow.id, plan.title);
                    await dataStore.refreshAppearanceForWindow(newWindow.id);
                }
            } catch (e) {
                if (e instanceof ImportAbort) throw e;
                // One window failing is not a reason to abandon the rest.
                console.debug(`importWindowsData: could not import "${plan.title}":`, e);
                windowFailures.push(plan.title || '(untitled)');
            }

            windowsDone++;
            showProgress();
        }
    } catch (e) {
        alert(`Import stopped after ${plural(windowsDone, 'window')}.\n\n${e.message}`);
    } finally {
        importing = false;
        setActionsEnabled(true);
        status.hidden = true;
        status.textContent = '';
        await populateWindowsList();
    }

    const report = [];
    if (skipped.length > 0) {
        console.debug('importWindowsData: skipped privileged URLs:', skipped);
        report.push(`${plural(skipped.length, 'tab')} skipped (privileged pages or local files).`);
    }
    if (failures.length > 0) {
        console.debug('importWindowsData: tabs that could not be created:', failures);
        report.push(`${plural(failures.length, 'tab')} could not be opened.`);
    }
    if (windowFailures.length > 0) {
        console.debug('importWindowsData: windows that could not be created:', windowFailures);
        report.push(`${plural(windowFailures.length, 'window')} could not be opened.`);
    }
    if (report.length > 0) alert(report.join('\n') + '\n\nSee the console for details.');
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

    document.querySelector('#window-details-close').addEventListener('click', hideWindowInfo);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideWindowInfo(); });

    document.querySelector('#export-button').addEventListener('click', exportWindowsData);

    const importFileInput = document.querySelector('#import-file-input');
    document.querySelector('#import-button').addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', async () => {
        if (importFileInput.files[0]) {
            await importWindowsData(importFileInput.files[0]);
            importFileInput.value = '';
        }
    });
    document.querySelector('#minimize-all-windows-button').addEventListener('click', minimizeAllWindows);
    document.querySelector('#unload-all-tabs-button').addEventListener('click', unloadAllTabs);
    document.querySelector('#refresh-appearance-button').addEventListener('click', refreshAppearanceForAllWindows);

    browser.tabs.onUpdated.addListener(scheduleRefresh);
    browser.tabs.onCreated.addListener(scheduleRefresh);
    browser.tabs.onRemoved.addListener(scheduleRefresh);
    browser.tabs.onActivated.addListener(scheduleRefresh);
    browser.tabs.onMoved.addListener(scheduleRefresh);
    browser.windows.onCreated.addListener(scheduleRefresh);
    browser.windows.onRemoved.addListener(scheduleRefresh);
    browser.windows.onFocusChanged.addListener(scheduleRefresh);
};
