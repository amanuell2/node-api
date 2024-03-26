const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const DeviceBan = Schema({
    deviceID: {
        type: String,
        unique: true,
    },
    driver: {
        type: Schema.Types.ObjectId,
        unique: true,
        ref: 'Drivers'
    },
    deviceModelID: {
        type: String,
    },
    allDevicesOfTheModel: {
        type: Boolean,
        default: false
    },
    note: {
        type: String
    }
},
    {
        timestamps: true
    })

DeviceBan.index(
    { deviceID: 1, driver: 1 },
    { unique: true }
)

DeviceBan.index(
    { deviceModelID: 1 },
    { unique: true, partialFilterExpression: { allDevicesOfTheModel: true }}
)

module.exports = mongoose.model(MODELS.DEVICE_BAN, DeviceBan);