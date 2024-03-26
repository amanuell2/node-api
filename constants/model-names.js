// written this way, so that you can't accidentally change those constants elsewhere
module.exports = class {
    static #_ACCOUNTS = "accounts";
    static #_ACTIVITY_LOGS = "ActivityLogs";
    static #_CITIES = "Cities";
    static #_CORPORATES = "Corporates";
    static #_CORPORATE_PAYMENTS = "CorporatePayments";
    static #_DEVICE_BAN = "DeviceBan";
    static #_DRIVER_BAN = "DriverBan";
    static #_DRIVERS = "Drivers";
    static #_EMPLOYEES = "Employees";
    static #_FAVORITE_PLACES = "FavoritePlaces";
    static #_INCENTIVES = "Incentive";
    static #_PASSENGER_RECORD = "PassengerRecord";
    static #_LOANS = "Loans";
    static #_LOGS = "logs";
    static #_DRIVER_LOCALIZATIONS = "driver-localizations";
    static #_PASSENGER_LOCALIZATIONS = "passenger-localizations";
    static #_MOCK_REPORTS = "MockReports";
    static #_NOTIFICATIONS = "Notifications";
    static #_POOLS = "Pools";
    static #_PROMOS = "Promos";
    static #_RENTS = "Rents";
    static #_RENT_REQUESTS = "RentRequestes";
    static #_RENT_SEARCHES = "RentSearches";
    static #_REWARDS = "Rewards";
    static #_REWARD_PACKAGES = "RewardPackages";
    static #_REWARD_PRIZES = "RewardPrizes";
    static #_RIDES = "Rides";
    static #_SETTING = "Setting";
    static #_SOS = "SOS";
    static #_TICKETS = "Tickets";
    static #_TOKENS = "Tokens";
    static #_POOL_REQUESTS = "PoolRequest";
    static #_POOL_SEARCHES = "PoolSearch";
    static #_TRIP_REQUESTS = "TripRequest";
    static #_TRIP_SEARCHES = "TripSearch";
    static #_USERS = "Users";
    static #_VEHICLES = "Vehicles";
    static #_VEHICLE_TYPES = "VehicleTypes";
    static #_VOUCHERS = "Voucher";
    static #_WALLET_HISTORY = "WalletHistories";
    static #_CORPORATE_ROLE = "CorporateRole";
    static #_DRIVER_STAT = "DriverStat";
    static #_ROLE = "Role";

    static get ACCOUNTS() { return this.#_ACCOUNTS; }
    static get ACTIVITY_LOGS() { return this.#_ACTIVITY_LOGS; }
    static get CITIES() { return this.#_CITIES; }
    static get CORPORATES() { return this.#_CORPORATES; }
    static get CORPORATE_PAYMENTS() { return this.#_CORPORATE_PAYMENTS; }
    static get DEVICE_BAN() { return this.#_DEVICE_BAN; }
    static get DRIVER_BAN() { return this.#_DRIVER_BAN; }
    static get DRIVERS() { return this.#_DRIVERS; }
    static get EMPLOYEES() { return this.#_EMPLOYEES; }
    static get FAVORITE_PLACES() { return this.#_FAVORITE_PLACES; }
    static get PASSENGER_RECORD() { return this.#_PASSENGER_RECORD; }
    static get INCENTIVES() { return this.#_INCENTIVES; }
    static get LOANS() { return this.#_LOANS; }
    static get LOGS() { return this.#_LOGS; }
    static get DRIVER_LOCALIZATIONS() { return this.#_DRIVER_LOCALIZATIONS; }
    static get PASSENGER_LOCALIZATIONS() { return this.#_PASSENGER_LOCALIZATIONS; }
    static get MOCK_REPORTS() { return this.#_MOCK_REPORTS; }
    static get NOTIFICATION() { return this.#_NOTIFICATIONS; }
    static get POOLS() { return this.#_POOLS; }
    static get PROMOS() { return this.#_PROMOS; }
    static get RENTS() { return this.#_RENTS; }
    static get RENT_REQUESTS() { return this.#_RENT_REQUESTS; }
    static get RENT_SEARCHES() { return this.#_RENT_SEARCHES; }
    static get REWARDS() { return this.#_REWARDS; }
    static get REWARD_PACKAGES() { return this.#_REWARD_PACKAGES; }
    static get REWARD_PRIZES() { return this.#_REWARD_PRIZES; }
    static get RIDES() { return this.#_RIDES; }
    static get SETTING() { return this.#_SETTING; }
    static get SOS() { return this.#_SOS; }
    static get TICKETS() { return this.#_TICKETS; }
    static get TOKENS() { return this.#_TOKENS; }
    static get POOL_REQUESTS() { return this.#_POOL_REQUESTS; }
    static get POOL_SEARCHES() { return this.#_POOL_SEARCHES; }
    static get TRIP_REQUESTS() { return this.#_TRIP_REQUESTS; }
    static get TRIP_SEARCHES() { return this.#_TRIP_SEARCHES; }
    static get USERS() { return this.#_USERS; }
    static get VEHICLES() { return this.#_VEHICLES; }
    static get VEHICLE_TYPES() { return this.#_VEHICLE_TYPES; }
    static get VOUCHERS() { return this.#_VOUCHERS; }
    static get WALLET_HISTORIES() { return this.#_WALLET_HISTORY; }
    static get CORPORATE_ROLE() { return this.#_CORPORATE_ROLE; }
    static get DRIVER_STAT() { return this.#_DRIVER_STAT; }
    static get ROLE() { return this.#_ROLE; }

}