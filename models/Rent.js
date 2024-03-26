const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const RentSchema = Schema({
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  dispatcher: {
    type: Schema.Types.ObjectId,
    ref: 'accounts'
  },
  cancelCost: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  startTimestamp: Date,
  endTimestamp: Date,
  vehicleType: {
    type: Schema.Types.ObjectId,
    ref: 'VehicleTypes'
  },
  note: String,
  cancelledBy: String,
  cancelledReason: String,
  pickUpAddress: {
    type: {
      name: String,
      coordinate: {
        type: {
          lat: Number,
          long: Number
        },
        required: true
      }
    },
    required: true
  },
  vehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicles'
  },
  fare: {
    type: Number,
    default: 0
  },
  companyCut: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  payedToDriver: {
    type: Number,
    default: 0
  },
  net: {
    type: Number,
    default: 0
  },
  status: String,
  createdBy: String,
  active: {
    type: Boolean,
    default: true
  }
},
  {
    timestamps: true
  }
)

RentSchema.index(
  { driver: 1 },
  {
    unique: true,
    partialFilterExpression: {
      active: true
    }
  }
)

RentSchema.index(
  { passenger: 1 },
  {
    unique: true,
    partialFilterExpression: {
      active: true
    }
  }
)

module.exports = mongoose.model(MODELS.RENTS, RentSchema)
