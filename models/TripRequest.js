const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const TripRequest = Schema({
  active: {
    type: Boolean,
    default: true
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Drivers'
  },
  passenger: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  dispatcher: {
    type: Schema.Types.ObjectId,
    ref: 'accounts'
  },
  orderedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  pickUpAddress: {
    type: {
      name: String,
      lat: Number,
      long: Number
    },
    required: true
  },
  dropOffAddress: {
    type: {
      name: String,
      lat: Number,
      long: Number
    },
    required: false
  },
  vehicleType: {
    type: Schema.Types.ObjectId,
    ref: 'VehicleTypes',
    required: true
  },
  route: {
    distance: Number,
    duration: Number,
    polyline: String,
  },
  vehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicles',
    required: true
  },
  ticket: {
    type: Schema.Types.ObjectId,
    ref: 'Tickets'
  },
  note: String,
  corporate: {
    type: Schema.Types.ObjectId,
    ref: 'Corporates'
  },
  schedule: Date,
  type: {
    type: String,
    default: 'normal'
  },
  stops: Array,
  bidAmount: Number,
  status: String,
  createdBy: String,
  tripSearchId: String,
  position: Object,
  dispatcherWhoCancelled: {
    type: Schema.Types.ObjectId,
    ref: 'accounts',
  },
  searchRound: {
    type: Number,
    default: 1
  },
  targetedDispatch: {
    type: Boolean
  },
  femaleOnlyRequired: Boolean,
},

  {
    timestamps: true
  }
)


TripRequest.index(
  { driver: 1 },
  {
    unique: true,
    partialFilterExpression: {
      active: true
    }
  }
)

TripRequest.index(
  { tripSearchId: 1 },
)

module.exports = mongoose.model(MODELS.TRIP_REQUESTS, TripRequest)

    // updateStatus(status) {
    //     this.status = status;
    //     this.updateCallback(this);
    // }

    // getStatus() {
    //     return this.status;
    // }