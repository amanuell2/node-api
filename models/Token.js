const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const TokenSchema = Schema({
  active: {
    type: Boolean,
    default: true
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  account: {
    type: Schema.Types.ObjectId,
    ref: 'accounts'
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: MODELS.ROLE
  },
  corporateRole: {
    type: Schema.Types.ObjectId,
    ref: MODELS.CORPORATE_ROLE
  },
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  }
},
{
  timestamps: true
}
)

module.exports = mongoose.model(MODELS.TOKENS, TokenSchema)
