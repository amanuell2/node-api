const mongoose = require('mongoose')
const Schema = mongoose.Schema

const MODELS = require('../constants/model-names')

const IMAGE_NOT_FOUND_URL = 'https://user-images.githubusercontent.com/24848110/33519396-7e56363c-d79d-11e7-969b-09782f5ccbab.png'

const vehicleSchema = Schema({
  modelName: {
    type: String,
    // required: true
    default: '-'
  },
  modelYear: {
    type: String,
    // required: true
    default: '-'
  },
  plateNumber: {
    type: String,
    required: true,
    unique: true,
  },
  photo: {
    type: String,
    // required: true
    default: IMAGE_NOT_FOUND_URL
  },
  color: {
    type: String,
    IMAGE_NOT_FOUND_URL,
    // required: true
    default: '-'
  },
  insurance: {
    type: String,
    // required: true
    default: IMAGE_NOT_FOUND_URL
  },
  libre: {
    type: String,
    // required: true
    default: IMAGE_NOT_FOUND_URL
  },
  vin: {
    type: String,
    // unique: true,
    // required: false
  },
  vehicleType: {
    type: Schema.Types.ObjectId,
    ref: 'VehicleTypes',
    required: true
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers',
    required: true
  },
  statusChangedIntentionally: {
    type: Boolean,
    default: false
  },
  position: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number] // longitude comes first
    }
  },
  lastTripTimestamp: Date,
  lastPingTimestamp: {
    type: Date
  },
  timestamp: {
    type: Date,
    required: false
  },
  fcm: {
    type: String,
    required: false
  },
  online: {
    type: Boolean,
    default: false,
    // validate: [
    //   function (value) {
    //     if (value)
    //       return ![this.tripId, this.poolId, this.tripRequestId].some(x => x);
    //     else
    //       return true
    //   }
    // ]
  },
  // poolId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Pools',
  // },
  // tripId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Rides'
  // },
  // tripRequestId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'TripRequest'
  // },
  // rentId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Rents'
  // },
  // rentRequestId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'RentRequests'
  // },
  active: {
    type: Boolean,
    default: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  inActiveTrip: {
    type: Boolean,
    default: false,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  inActivePool: Boolean,
  poolId: String,
  isFemaleDriver: Boolean
},
  {
    timestamps: true
  })

// vehicleSchema.pre('updateOne', function (next) {
//   const data = this.getUpdate()

//   if (data.online) {
//     if (data.poolId || data.tripId || data.tripRequestId || data.rentId || data.rentRequestId) {
//       next(new Error("can not mark vehicle as online (in trip, request or rent)"))
//     } else {
//       this.setUpdate(data)
//       next()
//     }
//   } else {
//     this.setUpdate(data)
//     next()
//   }

// })

vehicleSchema.index({ active: 1, online: 1, position: '2dsphere' })

module.exports = mongoose.model(MODELS.VEHICLES, vehicleSchema)
