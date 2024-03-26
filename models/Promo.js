const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const Promo = Schema({
    passenger: {
        type: Schema.Types.ObjectId,
        ref: 'Users'
    },
    driver: {
        type: Schema.Types.ObjectId,
        ref: 'Drivers'
    },
    inviteePhoneNumber: {
        type: String,
        required: true
    },
    // code: {
    //     type: String,
    //     default: function () {
    //         return String(Math.floor(Math.random() * 100000))
    //     }
    // },
    type: {
        type: String,
        required: true,
        enum: ['passenger', 'driver'],
    },
    tripCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        default: "INVITED"
    },
},
    {
        timestamps: true
    })

Promo.index(
    { passenger: 1, driver: 1, type: 1, inviteePhoneNumber: 1 },
    {
        unique: true,
    }
)

Promo.index(
    { inviteePhoneNumber: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "ACTIVE"
        }
    }
)

module.exports = mongoose.model(MODELS.PROMOS, Promo);