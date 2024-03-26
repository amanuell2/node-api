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
    "corporate-dashboard": { "type": PermissionScope },
    "tickets": { "type": PermissionScope },
    "employees": { "type": PermissionScope },
    "corporate-dispatcher": { "type": PermissionScope },
    "corporate-trips": { "type": PermissionScope },
    "corporate-trip-searches": { "type": PermissionScope },
    "corporate-trip-requests": { "type": PermissionScope },
  }
)

const RoleSchema = Schema({
    "roleName": { "type": String, unique: true },
    corporate: {
      type: Schema.Types.ObjectId,
      ref: 'Corporates',
      required: true
    },
    "permissions": {
      "type": PermissionsSchema,
      "default": {
        "corporate-dashboard": { "type": PermissionScope },
        "tickets": { "type": PermissionScope },
        "employees": { "type": PermissionScope },
        "corporate-dispatcher": { "type": PermissionScope },
        "corporate-trips": { "type": PermissionScope },
        "corporate-trip-searches": { "type": PermissionScope },
        "corporate-trip-requests": { "type": PermissionScope },
      }
    }
  },
  {
    timestamps: true
  }
)


RoleSchema.index(
  { corporate: 1, roleName: 1 },
  {
    unique: true,
  }
)


module.exports = mongoose.model(MODELS.CORPORATE_ROLE, RoleSchema)
