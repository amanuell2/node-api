const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const CorporateSchema = Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  shortName: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  pricing: {
    type: {
      pricePerKM: {
        type: Number,
        required: true
      },
      pricePerMin: {
        type: Number,
        required: true
      },
      baseFare: {
        type: Number,
        required: true
      },
    },
    required:true,
  }
},
  {
    timestamps: true
  })

module.exports = mongoose.model(MODELS.CORPORATES, CorporateSchema)
