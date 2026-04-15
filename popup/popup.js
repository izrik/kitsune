import {getDataStore} from '/datastore.js';

console.debug("popup module-level");

const dataStore = getDataStore();

document.querySelector('#popup-form').addEventListener('submit', async (e) => {
    console.debug('popup form submitted');
    e.preventDefault();
    const title = document.querySelector('#user-window-title-input').value;
    const currentWindow = await browser.windows.getCurrent();
    await dataStore.saveTitleForWindow(currentWindow.id, title);
    await dataStore.refreshAppearanceForWindow(currentWindow.id);
    window.close();
})

document.querySelector('#btn-settings').addEventListener('click', async (e) => {
    console.debug('settings button clicked');
    browser.tabs.create({ url: '../manager/manager.html', active: true });
    window.close();
})

window.onload = async () => {
    const currentWindow = await browser.windows.getCurrent();
    const userWindowTitleInput = document.querySelector('#user-window-title-input');
    userWindowTitleInput.value = await dataStore.getTitleForWindow(currentWindow.id);
    userWindowTitleInput.select();
};
