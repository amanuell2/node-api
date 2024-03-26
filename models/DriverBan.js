const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const DriverBan = Schema({
    driver: {
        type: Schema.Types.ObjectId,
        ref: 'Drivers'
    },
    note: {
        type: String
    },
    active: {
        type: Boolean,
        default: false,
        required: true,
    }
},
    {
        timestamps: true
    })

DriverBan.index(
    { driver: 1 },
    { unique: true, partialFilterExpression: { active: true } }
)

module.exports = mongoose.model(MODELS.DRIVER_BAN, DriverBan);