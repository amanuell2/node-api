module.exports = class {
    static #_STARTED = "STARTED";
    static #_COMPLETED = "COMPLETED";
    static #_IN_PROGRESS = "IN_PROGRESS";
    static #_CANCELLED = "CANCELLED";
    static #_NO_DRIVERS_FOUND = "NO_DRIVERS_FOUND";

    static get STARTED() { return this.#_STARTED; }
    static get COMPLETED() { return this.#_COMPLETED; }
    static get IN_PROGRESS() { return this.#_IN_PROGRESS; }
    static get CANCELLED() { return this.#_CANCELLED; }
    static get NO_DRIVERS_FOUND() { return this.#_NO_DRIVERS_FOUND; }
} 
