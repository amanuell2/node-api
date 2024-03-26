// written this way, so that you can't accidentally change those constants elsewhere
module.exports = class {
    static #_STARTED = "STARTED";
    static #_ACCEPTED = "ACCEPTED";
    static #_COMPLETED = "COMPLETED";
    static #_IN_PROGRESS = "IN_PROGRESS";
    static #_CANCELLED = "CANCELLED";


    // TODO: verify those fields
    static get STARTED() { return this.#_STARTED; }
    static get ACCEPTED() { return this.#_ACCEPTED; }
    static get COMPLETED() { return this.#_COMPLETED; }
    static get IN_PROGRESS() { return this.#_IN_PROGRESS; }
    static get CANCELLED() { return this.#_CANCELLED; }
}