const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const NotificationSchema = Schema(
  {
    title: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    medium: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model(MODELS.NOTIFICATION, NotificationSchema)
