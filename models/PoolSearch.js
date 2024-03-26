const mongoose = require('mongoose')
const Schema = mongoose.Schema

const MODELS = require('../constants/model-names')

const POOL_SEARCH_STATUSES = require('../constants/pool-search-statuses')

const PoolSearch = Schema({
    active: {
        type: Boolean,
        default: true
    },
    requestedVehicles: [{
        type: Schema.Types.ObjectId,
        ref: 'Vehicles'
    }],
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
    status: {
        type: String,
        default: POOL_SEARCH_STATUSES.IN_PROGRESS
    },
    createdBy: String,
    dispatcherWhoCancelled: {
        type: Schema.Types.ObjectId,
        ref: 'accounts',
    },
    cancelledBy: String,
    cancelledReason: String,
    searchRound: {
        type: Number,
        default: 1
    },
    size: Number,
    femaleOnlyRequired: Boolean
},

    {
        timestamps: true
    }
)

PoolSearch.index(
    { passenger: 1 },
    {
        unique: true,
        partialFilterExpression: {
            active: true
        }
    }
)

module.exports = mongoose.model(MODELS.POOL_SEARCHES, PoolSearch)