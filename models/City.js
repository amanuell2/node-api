const mongoose = require('mongoose')
const MODELS = require('../constants/model-names')

const citySchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  }
},
{
  timestamps: true
})

module.exports = mongoose.model(MODELS.CITIES, citySchema)
