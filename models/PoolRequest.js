const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const PoolRequest = Schema({
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
    type: {
        type: String,
        default: 'CREATE' // CREATE, JOIN
    },
    pool: {
        type: Schema.Types.ObjectId,
        ref: MODELS.POOLS
    },
    bidAmount: Number,
    status: String,
    createdBy: String,
    poolSearchId: String,
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
    size: Number,
    femaleOnlyRequired: Boolean
},

    {
        timestamps: true
    }
)


PoolRequest.index(
    { driver: 1 },
    {
        unique: true,
        partialFilterExpression: {
            active: true
        }
    }
)

PoolRequest.index(
    { poolSearchId: 1 },
)

module.exports = mongoose.model(MODELS.POOL_REQUESTS, PoolRequest)