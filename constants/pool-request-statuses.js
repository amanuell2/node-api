module.exports = class {
    static #_IN_REQUEST = "IN_REQUEST";
    static #_EXPIRED = "EXPIRED";
    static #_CANCELLED = "CANCELLED";
    static #_ACCEPTED = "ACCEPTED";
    static #_DECLINED = "DECLINED";

    static get IN_REQUEST() { return this.#_IN_REQUEST; }
    static get EXPIRED() { return this.#_EXPIRED; }
    static get CANCELLED() { return this.#_CANCELLED; }
    static get ACCEPTED() { return this.#_ACCEPTED; }
    static get DECLINED() { return this.#_DECLINED; }
} 
