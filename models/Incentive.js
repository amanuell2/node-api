const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const Passenger = require('./User')

const IncentiveSchema = Schema({
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  ride: {
    type: Schema.Types.ObjectId,
    ref: 'Rides'
  },
  rent: {
    type: Schema.Types.ObjectId,
    ref: 'Rents'
  },
  rate: {
    type: Number
  },
  every: {
    type: Number
  },
  tripCount: {
    type: Number
  },
  passengerTripCount: {
    type: Number
  },
  fare: {
    type: Number
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'paid', 'collected'
    ],
    default: 'paid'
  },
  reason: {
    type: String,
    default: function () {
      if (this.rate && this.every)
        return `${this.rate}% every ${this.every} trip(s)`
      return ""
    }
  },
  currentAmount: {
    type: Number
  },
  voucher: {
    type: Schema.Types.ObjectId,
    ref: 'Voucher'
  }
},
  {
    timestamps: true
  }
)

/*
db.incentives.createIndex({ ride: 1, passenger: 1, every: 1, rate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ride: { $exists: true },
    }
  })
*/

IncentiveSchema.index(
  { ride: 1, passenger: 1, every: 1, rate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ride: { $exists: true },
    }
  }
)

IncentiveSchema.pre('save', function (next) {
  Passenger.findOne({
    _id: mongoose.Types.ObjectId(this.passenger)
  }).then(({ balance }) => {
    this.currentAmount = balance
    next()
  }).catch(async err => {
    await this.delete()
  })
})
module.exports = mongoose.model(MODELS.INCENTIVES, IncentiveSchema)
