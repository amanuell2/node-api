const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const RentSearch = Schema({
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
    duration: {
        type: Number,
        required: true,
    },
    pickUpAddress: {
        type: {
            name: String,
            lat: Number,
            long: Number
        },
        required: true
    },
    vehicleType: {
        type: Schema.Types.ObjectId,
        ref: 'VehicleTypes',
        required: true
    },
    note: String,
    status: {
        type: String,
        default: "IN_PROGRESS"
    },
    type: {
        type: String,
        default: 'rent'
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
    }
},
    {
        timestamps: true
    }
)


RentSearch.index(
    { passenger: 1 },
    {
        unique: true,
        partialFilterExpression: {
            active: true
        }
    }
)

module.exports = mongoose.model(MODELS.RENT_SEARCHES, RentSearch)