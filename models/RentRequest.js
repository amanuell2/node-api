const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const RentRequest = Schema({
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
    note: String,
    type: {
        type: String,
        default: 'rent'
    },
    status: String,
    createdBy: String,
    position: Object,
    rentSearchId: String,
    targetedDispatch: {
        type: Boolean
      }
},

    {
        timestamps: true
    }
)


RentRequest.index(
    { driver: 1 },
    {
        unique: true,
        partialFilterExpression: {
            active: true
        }
    }
)

RentRequest.index(
    { tripSearchId: 1 },
)


module.exports = mongoose.model(MODELS.RENT_REQUESTS, RentRequest)

    // updateStatus(status) {
    //     this.status = status;
    //     this.updateCallback(this);
    // }

    // getStatus() {
    //     return this.status;
    // }