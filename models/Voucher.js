const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')


const VoucherSchema = Schema({
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers',
  },
  serialNumber: {
    type: String,
    required: true
  },
  expirationDate: {
    type: Date,
    required: true
  },
  voucher: {
    type: String,
    required: true
  }
},
{
  timestamps: true
}
)

module.exports = mongoose.model(MODELS.VOUCHERS, VoucherSchema)
