const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const statSchema = Schema({
    onlineHours: Number,
    lastUpdatedAt: Date,
})

const DriverStatSchema = Schema({

    driver: {
        type: Schema.Types.ObjectId,
        ref: 'Drivers',
        required: true
    },
    vehicle: {
        type: Schema.Types.ObjectId,
        ref: 'Vehicles',
        required: true
    },
    sunday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    monday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    tuesday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    wednesday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    thursday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    friday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
    saturday: { type: statSchema, default: { onlineHours: 0, lastUpdatedAt: Date.now() } },
},
    {
        timestamps: true
    })

module.exports = mongoose.model(MODELS.DRIVER_STAT, DriverStatSchema)
