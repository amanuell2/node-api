const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')


const VehicleTypeSchema = Schema({
  name: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  city: {
    type: Schema.Types.ObjectId,
    ref: 'Cities'
  },
  pricePerKM: {
    type: Number,
    required: true
  },
  photo: {
    type: String,
    required: true
  },
  numberOfSeats: {
    type: Number,
    required: true
  },
  pricePerMin: {
    type: Number,
    required: true
  },
  city: {
    type: String,
    required: true,
    default: "Addis Ababa",
  },
  surgePricePerKM: {
    type: Number,
    required: true,
    default: function () {
      return this.pricePerKM
    }
  },
  surgePricePerMin: {
    type: Number,
    required: true,
    default: function () {
      return this.pricePerMin
    }
  },
  surgeBaseFare: {
    type: Number,
    required: true,
    default: function () {
      return this.baseFare
    }
  },
  surgePrice: {
    type: Number,
    required: true
  },
  baseFare: {
    type: Number,
    required: true
  },
  priceForMediumWorkers: {
    type: Number,
    required: true
  },
  priceForHardWorkers: {
    type: Number,
    required: true
  },
  rentPerHour: {
    type: Number,
    default: 0
  },
  rentPerDay: {
    type: Number,
    default: 0
  },
  rentDiscount: {
    type: Number,
    default: 0
  },
  poolBaseFare: {
    type: Number,
    required: true,
    default: function () {
      return this.baseFare
    }
  },
  poolPricePerKM: {
    type: Number,
    required: true,
    default: function () {
      return this.pricePerKM
    }
  },
  poolPricePerMin: {
    type: Number,
    required: true,
    default: function () {
      return this.pricePerMin
    }
  },
  order: {
    type: Number
  },
  isAnyType: {
    type: Boolean
  }
},
{
  timestamps: true
})

VehicleTypeSchema.pre('save', function (next) {
  this.constructor.find({}).sort({ order: -1 }).limit(1).exec((err, result) => {
    console.log(err, result)
    if (err || !result.length) { this.order = 1 } else { this.order = result[0].order + 1 }
    next()
  })
})

const vehicleType = mongoose.model(MODELS.VEHICLE_TYPES, VehicleTypeSchema)

module.exports = vehicleType
