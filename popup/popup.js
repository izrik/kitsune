import DataStore from '/kitsune.js';

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
};
