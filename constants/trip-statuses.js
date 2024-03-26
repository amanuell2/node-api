// written this way, so that you can't accidentally change those constants elsewhere
module.exports = class {
    static #_STARTED = "STARTED";
    static #_ARRIVED = "ARRIVED";
    static #_COMPLETED = "COMPLETED";
    static #_CANCELLED = "CANCELLED";
    static #_ACCEPTED = "ACCEPTED";
    static #_SCHEDULED = "SCHEDULED";

    static get STARTED() { return this.#_STARTED; }
    static get ARRIVED() { return this.#_ARRIVED; }
    static get COMPLETED() { return this.#_COMPLETED; }
    static get CANCELLED() { return this.#_CANCELLED; }
    static get ACCEPTED() { return this.#_ACCEPTED; }
    static get SCHEDULED() { return this.#_SCHEDULED; }
}