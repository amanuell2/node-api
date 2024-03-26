const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const PermissionScope = Schema({
  canAccess: {
    type: Boolean,
  }
})

const PermissionsSchema = Schema(
  {
    "dashboard": { "type": PermissionScope },
    "users": { "type": PermissionScope },
    "tickets": { "type": PermissionScope },
    "passengers": { "type": PermissionScope },
    "incentives": { "type": PermissionScope },
    "drivers": { "type": PermissionScope },
    "rbac": { "type": PermissionScope },
    "reports": { "type": PermissionScope },
    "trips": { "type": PermissionScope },
    "trip-searches": { "type": PermissionScope },
    "trip-requests": { "type": PermissionScope },
    "rents": { "type": PermissionScope },
    "reward-history": { "type": PermissionScope },
    "reward-packages": { "type": PermissionScope },
    "reward-inventory": { "type": PermissionScope },
    "manual-trip-booking": { "type": PermissionScope },
    "banned-drivers": { "type": PermissionScope },
    "finance": { "type": PermissionScope },
    "wallet-managment": { "type": PermissionScope },
    "loan-history": { "type": PermissionScope },
    "vehicle-type": { "type": PermissionScope },
    "vehicles": { "type": PermissionScope },
    "promo-history": { "type": PermissionScope },
    "device-bans": { "type": PermissionScope },
    "drivers-leaderboard": { "type": PermissionScope },
    "passengers-leaderboard": { "type": PermissionScope },
    "mock-reports": { "type": PermissionScope },
    "birds-eye-view": { "type": PermissionScope },
    "sos": { "type": PermissionScope },
    "sos-history": { "type": PermissionScope },
    "push-notification": { "type": PermissionScope },
    "site-setting": { "type": PermissionScope },
    "activity-logs": { "type": PermissionScope },
    "logs": { "type": PermissionScope },
    // "drivers-localizations": { "type": PermissionScope },
    // "passenger-localizations": { "type": PermissionScope },
    "localization": { "type": PermissionScope },
    "drivers-finance": { "type": PermissionScope },
  }
)

const RoleSchema = Schema({
  "roleName": { "type": String, unique: true },
  "permissions": {
    "type": PermissionsSchema,
    "default": {
      "dashboard": { "canAccess": true },
      "users": { "canAccess": true },
      "corporate-management": { "canAccess": true },
      "passengers": { "canAccess": true },
      "incentives": { "canAccess": true },
      "drivers": { "canAccess": true },
      "rbac": { "canAccess": false },
      "reports": { "canAccess": true },
      "trips": { "canAccess": true },
      "trip-searches": { "canAccess": true },
      "trip-requests": { "canAccess": true },
      "rents": { "canAccess": true },
      "reward-history": { "canAccess": true },
      "reward-packages": { "canAccess": true },
      "reward-inventory": { "canAccess": true },
      "manual-trip-booking": { "canAccess": true },
      "banned-drivers": { "canAccess": true },
      "finance": { "canAccess": true },
      "wallet-managment": { "canAccess": true },
      "loan-history": { "canAccess": true },
      "vehicle-type": { "canAccess": true },
      "vehicles": { "canAccess": true },
      "promo-history": { "canAccess": true },
      "device-bans": { "canAccess": true },
      "drivers-leaderboard": { "canAccess": true },
      "passengers-leaderboard": { "canAccess": true },
      "mock-reports": { "canAccess": true },
      "birds-eye-view": { "canAccess": true },
      "sos": { "canAccess": true },
      "sos-history": { "canAccess": true },
      "push-notification": { "canAccess": true },
      "site-setting": { "canAccess": true },
      "activity-logs": { "canAccess": true },
      "logs": { "canAccess": true },
      // "drivers-localizations": { "canAccess": true },
      // "passenger-localizations": { "canAccess": true },
      "localization": { "canAccess": true },
      "corporate-reports": { "canAccess": true },
      "drivers-finance": { "canAccess": true },
    }
  }

},
  {
    timestamps: true
  })
  

module.exports = mongoose.model(MODELS.ROLE, RoleSchema)
