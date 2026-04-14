
export class WindowData {
    constructor(options = {}) {
        this.window = options.window || null;
        this.displayTitle = options.displayTitle || '';
        this.tabCount = options.tabCount || 0;
        this.isCurrentWindow = options.isCurrentWindow || false;
        this.id = options.id || null;
        this.tabs = options.tabs || [];
    }
}
