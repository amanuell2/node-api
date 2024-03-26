const mongoose = require('mongoose')
const Schema = mongoose.Schema
const POOL_STATUS = require('../constants/pool-statuses')
const MODELS = require('../constants/model-names')
const { ObjectId } = require('mongoose').Types

const MessageSchema = Schema({
  sentByDriver: Boolean,
  message: String,
  sentBy: ObjectId,
  timestamp: {type : Date, default: Date.now }
})

const PoolSchema = Schema({
  size: {
    type: Number,
    required: true
  },
  trips: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Rides'
    }
  ],
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  poolEnded: {
    type: Boolean, 
    default: false
  },
  route: {
    distance: Number,
    duration: Number,
    polyline: String,
  },
  path: {
    type: [[Number]],
    default: []
  },
  // dispatcher: {
  //     type: Schema.Types.ObjectId,
  //     ref: "accounts"
  // },
  position: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number] // longitude comes first
    }
  },
  pickUpAddress: {
    type: {
      name: String,
      lat: Number,
      long: Number
    },
    required: true
  },
  fare: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number,
    default: 0
  },
  distanceCovered: {
    type: Number,
    default: 0
  },
  totalDistance: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date
  },
  dropOffAddress: {
    type: {
      name: String,
      lat: Number,
      long: Number
    },
    required: true
  },
  vehicleType: {
    type: Schema.Types.ObjectId,
    ref: 'VehicleTypes',
    required: true
  },
  vehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicles',
    required: true
  },
  cancelledBy: String,
  cancelledReason: String,
  status: {
    type: String,
    default: POOL_STATUS.CREATED
  },
  chat: [
    MessageSchema
  ],
  active: {
    type: Boolean,
    default: true,
  }
},
{
  timestamps: true
})

PoolSchema.index( { position : "2dsphere" } )

PoolSchema.index({ status: 1, position: '2dsphere', driver: 1 })

PoolSchema.index(
  { driver: 1 },
  { unique: true, partialFilterExpression: { active: true } }
)

module.exports = mongoose.model(MODELS.POOLS, PoolSchema)