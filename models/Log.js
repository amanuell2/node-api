const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const LogSchema = Schema({
  timestamp: Date,
  level: String,
  message: String,
  meta: Object
})

module.exports = mongoose.model(MODELS.LOGS, LogSchema)
