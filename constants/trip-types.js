// written this way, so that you can't accidentally change those constants elsewhere
module.exports = class {
    static #_ROAD_PICKUP = "roadPickup";
    static #_NORMAL = "normal";
    static #_CORPORATE = "corporate";
    static #_BID = "bid";
    static #_POOL = "pool";

    static get ROAD_PICKUP() { return this.#_ROAD_PICKUP; }
    static get NORMAL() { return this.#_NORMAL; }
    static get CORPORATE() { return this.#_CORPORATE; }
    static get BID() { return this.#_BID; }
    static get POOL() { return this.#_POOL; }
}