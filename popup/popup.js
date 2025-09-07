import {getDataStore} from '/datastore.js';

console.log("popup module-level");

const dataStore = getDataStore();

async function getCurrentWindowTitle() {
    const currentWindow = await window.browser.windows.getCurrent();
    const currentWindowTitle = await dataStore.getTitleForWindow(currentWindow.id);

    return currentWindowTitle;
}

async function setWindowTitle(title, windowId) {
    console.log(`setWindowTitle("${title}", "${windowId}")`);
    await dataStore.saveTitleForWindow(windowId, title);
    await dataStore.refreshAppearanceForWindow(windowId);
}

async function refreshPopup() {
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

document.querySelector('#btn-settings').addEventListener('click', async (e) => {
    console.log('settings button clicked');
    browser.tabs.create({ url: '../manager/manager.html', active: true });
    window.close();
})

window.onload = async () => {
    const currentWindowTitle = await getCurrentWindowTitle();
    const userWindowTitleInput = document.querySelector('#user-window-title-input');
    userWindowTitleInput.value = currentWindowTitle;
    userWindowTitleInput.select();

    await refreshPopup();
};
