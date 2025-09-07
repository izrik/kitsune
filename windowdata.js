
export class WindowData {
    constructor(options = {}) {
        this.window = options.window || null;                       // runtime only
        this.displayTitle = options.displayTitle || '';             // constant; what's the difference between this and "title"?
        this.tabCount = options.tabCount || 0;                      // get at run time when needed
        this.isCurrentWindow = options.isCurrentWindow || false;    // don't store
        this.isSleeping = options.isSleeping || false;              //
        this.sleepingData = options.sleepingData || null;           // ???
        this.id = options.id || null;                               //
        this.title = options.title || '';                           // what's the difference between this and "displayTitle"?
        this.state = options.state || '';                           // get at runtime when putting to sleep
        this.uuid = options.uuid || null;                           // constant
        this.sleepTime = options.sleepTime || null;                 // get at runtime when putting to sleep
        this.tabs = options.tabs || [];                             // get at runtime when putting to sleep
    }
}
