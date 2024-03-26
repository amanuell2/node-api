const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const CashBackSetting = Schema({
  every: Number,
  rate: Number
})

const VoucherSettings = Schema({
  domain: String,
  username: String,
  password: String,
  voucherTypes: [
    {
      amount: {
        type: Number,
        required: true
      },
      id: {
        type: String,
        required: true
      }
    }
  ]
})

const SMSSettings = Schema({
  endpoint: String,
  username: String,
  password: String,
  dlrMask: Number,
  dlrURL: String
})

const LinkSettings = Schema({
  driverAppstoreLink: String,
  driverPlaystoreLink: String,
  passengerAppstoreLink: String,
  passengerPlaystoreLink: String,
  driverPrivacyPolicyLink: {
    type: String,
    default: ''
  },
  driverTermsAndConditionLink: {
    type: String,
    default: ''
  },
  passengerPrivacyPolicyLink: {
    type: String,
    default: ''
  },
  passengerTermsAndConditionLink: {
    type: String,
    default: ''
  }
})

const TimeSchema = Schema({
  hour: Number,
  minute: Number
})

const SettingSchema = Schema({
  logo: String,
  favIcon: String,
  // links: {
  //   type: LinkSettings,
  // },
  driverAppstoreLink: String,
  driverPlaystoreLink: String,
  passengerAppstoreLink: String,
  passengerPlaystoreLink: String,
  driverPrivacyPolicyLink: {
    type: String,
    default: ''
  },
  driverTermsAndConditionLink: {
    type: String,
    default: ''
  },
  passengerPrivacyPolicyLink: {
    type: String,
    default: ''
  },
  passengerTermsAndConditionLink: {
    type: String,
    default: ''
  },
  requestTimeout: {
    type: Number,
    default: 25
  },
  waitingTime: {
    type: Number,
    default: 25
  },
  searchRadius: {
    type: Number,
    default: 3
  },
  surgeTimeFrom: {
    type: TimeSchema,
    default: {
      hour: null,
      minute: null,
    }
  },
  surgeTimeUpto: {
    type: TimeSchema,
    default: {
      hour: null,
      minute: null,
    }
  },
  rentSearchRadius: {
    type: Number,
    default: 3
  },
  scheduleSearchRadius: {
    type: Number,
    default: 3
  },
  sosDayLimit: {
    type: Number,
    default: 1
  },
  androidDriverVersion: {
    type: String,
    default: '0.0.1'
  },
  androidPassengerVersion: {
    type: String,
    default: '0.0.1'
  },
  iosDriverVersion: {
    type: String,
    default: '0.0.1'
  },
  iosPassengerVersion: {
    type: String,
    default: '0.0.1'
  },
  leastAndroidDriverVersion: {
    type: String,
    default: '0.0.1'
  },
  leastAndroidPassengerVersion: {
    type: String,
    default: '0.0.1'
  },
  leastIosDriverVersion: {
    type: String,
    default: '0.0.1'
  },
  leastIosPassengerVersion: {
    type: String,
    default: '0.0.1'
  },
  bidDriversPerRequest: {
    type: Number,
    default: 1
  },
  tax: {
    type: Number,
    default: 15
  },
  defaultCommission: {
    type: Number,
    default: 15
  },
  rentCommission: {
    type: Number,
    default: 15
  },
  defaultRoadPickupCommission: {
    type: Number,
    default: 5
  },
  cancelCost: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  promoAmount: {
    type: Number,
    default: 0
  },
  promoRate: {
    type: Number,
    default: 0
  },
  promoTripCount: {
    type: Number,
    default: 0
  },
  incentiveSettings: [
    CashBackSetting
  ],
  voucherSettings: {
    type: VoucherSettings,
    default: {
      domain: '',
      username: '',
      password: '',
      voucherTypes: [
      ]
    }
  },
  smsSettings: {
    type: SMSSettings,
    default: {
      endpoint: 'http://172.168.9.74:13131/cgi-bin/sendsms',
      username: 'chief',
      password: 'chief',
      dlrMask: 7,
      dlrURL: 'http://172.168.11.203:9090/api/outboxes/dlr'
    }
  },
  contactNumber: String,
  contactEmail: String,
  facebookLink: String,
  googleLink: String,
  twitterLink: String,
  mapKey: String,
  creditAllowance: Number,
  mediumWorkerAverageTrip: Number,
  hardWorkerAverageTrip: Number,
  localization: {
    type: Object
  },
  nearByPoolsSearchDistance: {
    type: Number,
    default: 500
  },
  nearByPoolsSearchLimit: {
    type: Number,
    default: 10
  },
  promoInvitationDailyQuota: {
    type: Number,
    default: 10
  },
  promoNumberOfTripsApplicable: {
    type: Number,
    default: 5
  },
  promoIncentiveRate: {
    type: Number,
    default: 5
  },
  maxNumberOfPromoPerDay: {
    type: Number,
    default: 10
  },
  deviceUnknownNote: {
    type: String,
    default: "Dear Driver, your device is unsupported on our system. please try again with a different device."
  },
  locationUpdateInterval: {
    type: Number,
    default: 2,
    required: true
  },
  generalGpsAccuracy: {
    type: Number,
    default: 70,
    required: true
  },
  onTripGpsAccuracy: {
    type: Number,
    default: 45,
    required: true
  },
  invitationPromoInviterAmount: {
    type: Number,
    default: 20,
    min: 0
  },
  invitationPromoInviteeAmount: {
    type: Number,
    default: 10,
    min: 0
  },
  firstTripIncentiveAmount: {
    type: Number,
    default: 100,
    min: 0
  },
  applyFirstTripIncentive: {
    type: Boolean,
    default: false,
  },
  invitationPromoEnabled: {
    type: Boolean,
  },
  numberOfPoolsToRequest: {
    type: Number,
    default: 3
  },
  poolDivergence: {
    type: Number,
    default: 1000
  }
},
{
  timestamps: true
})

module.exports = mongoose.model(MODELS.SETTING, SettingSchema)
