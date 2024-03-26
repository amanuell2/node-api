const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const SOSSchema = Schema({
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  vehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicles'
  },
  ride: {
    type: Schema.Types.ObjectId,
    ref: 'Rides'
  },
  rent: {
    type: Schema.Types.ObjectId,
    ref: 'Rents'
  },
  type: String,
  position: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // longitude comes first
      required: true
    }
  }
},
{
  timestamps: true
})

module.exports = mongoose.model(MODELS.SOS, SOSSchema)
