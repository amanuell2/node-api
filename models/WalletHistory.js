const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Driver = require('./Driver')

const MODELS = require('../constants/model-names')

const WalletHistorySchema = Schema({
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers',
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
  amount: {
    type: Number,
    required: true
  },
  reason: String,
  paymentType: {
    type: String,
    default: ''
  },
  account: {
    type: Schema.Types.ObjectId,
    ref: 'accounts'
  },
  by: {
    type: String,
    required: true
  },
  from: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  status: {
    type: String,
    enum: [
      'unpaid', 'paid'
    ],
    default: function () {
      return this.paymentType === 'bank_deposit' ? 'unpaid' : 'paid'
    }
  },
  currentAmount: {
    type: Number
  },
  deposit: {
    type: new Schema({
      bank: {
        type: String
      },
      by: {
        type: String
      },
      transaction: {
        type: String
      },
      narrative: {
        type: String
      },
      date: {
        type: String
      },
      status: {
        type: String,
        enum: [
          'unpaid', 'denied', 'paid'
        ],
        default: 'unpaid'
      }
    })
  },
  telebirr: {
    type: new Schema({
      TransType: {
        type: String
      },
      TransID: {
        type: String
      },
      TransTime: {
        type: String
      },
      BusinessShortCode: {
        type: String
      },
      MSISDN: {
        type: String
      },
      status: {
        type: String,
        enum: [
          'unpaid', 'denied', 'paid'
        ],
        default: 'unpaid'
      }
    })
  }
},
{
  timestamps: true
}
)

WalletHistorySchema.index(
  { ride: 1, driver: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ride: { $exists: true },
      reason: "commission",
    }
  }
)

WalletHistorySchema.index(
  { rent: 1, driver: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rent: { $exists: true },
    }
  }
)

WalletHistorySchema.index(
  { ride: 1, reason: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reason : "corporate",
    }
  }
)

// db.wallethistories.find({ type: "commission"}, {ride:1, reason: 1}).sort({_id:1}).forEach(function(doc){
//   db.wallethistories.remove({_id:{$gt:doc._id}, ride:doc.ride, reason: 'commission'});
// })

WalletHistorySchema.pre('save', function (next) {
  Driver.findOne({
    _id: mongoose.Types.ObjectId(this.driver)
  }).then(({ ballance }) => {
    this.currentAmount = ballance
    next()
  }).catch(async err => {
    await this.delete()
  })

  // .sort({ order : -1 }).limit(1).exec((err, result) => {
  //     console.log(err, result)
  //     if (err || !result.length)
  //         this.order = 1
  //     else
  //         this.order = result[0].order + 1
  //     next();
  // })
})
module.exports = mongoose.model(MODELS.WALLET_HISTORIES, WalletHistorySchema)
