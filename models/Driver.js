const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const DriverSchema = Schema({
  firebaseId: {
    type: String,
    required: false
  },
  driverId: {
    type: String,
    required: false
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false
  },
  businessLicense: {
    type: String,
    required: false
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\+251\d{3}\d{6}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
  },
  profileImage: {
    type: String,
    required: false
  },
  representationPaper: {
    type: String,
    required: false
  },
  drivingLicense: {
    type: String,
    required: false
  },
  rating: {
    type: Number,
    default: 5.0
  },
  rateCount: {
    type: Number,
    default: 1
  },
  ballance: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  approved: {
    type: Boolean,
    default: false
  },
  additionalDocuments: {
    type: [String]
  },
  completed: {
    type: Boolean,
    default: false
  },
  socketId: String,
  fcm: String,
  deviceID: String,
  deviceModelID: String,
  isFemaleDriver: Boolean,
  isBanned: {
    type: Boolean,
    default: false
  },
  isEmployee: {
    type: Boolean,
    default: false,
    required: true,
  }
},
{
  timestamps: true
})

module.exports = mongoose.model(MODELS.DRIVERS, DriverSchema)
