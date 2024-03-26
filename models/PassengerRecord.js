const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const PassengerRecord = Schema({
    passenger: {
        type: Schema.Types.ObjectId,
        ref: 'Users'
    },
    reason: {
        type: String,
    },
    amount: {
        type: Number
    },
    invitee: {
        type: Schema.Types.ObjectId,
        ref: 'Users'
    }
},
    {
        timestamps: true
    })

module.exports = mongoose.model(MODELS.PASSENGER_RECORD, PassengerRecord);