module.exports = class {
    static #_ADMIN = 1;
    static #_DISPATCHER = 2;
    static #_FINANCE = 3;
    static #_CORPORATE = 4;
    static #_DRIVER = 5;
    static #_PASSENGER = 6;
    static #_OPERATION = 7;

    static get ADMIN() { return this.#_ADMIN; }
    static get DISPATCHER() { return this.#_DISPATCHER; }
    static get FINANCE() { return this.#_FINANCE; }
    static get CORPORATE() { return this.#_CORPORATE; }
    static get DRIVER() { return this.#_DRIVER; }
    static get PASSENGER() { return this.#_PASSENGER; }
    static get OPERATION() { return this.#_OPERATION; }
}