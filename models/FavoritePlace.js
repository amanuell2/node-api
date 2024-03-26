const mongoose = require('mongoose')
const MODELS = require('../constants/model-names')

const favoritePlacesSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
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

module.exports = mongoose.model(MODELS.FAVORITE_PLACES, favoritePlacesSchema)
