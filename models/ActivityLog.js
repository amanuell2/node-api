const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MODELS = require('../constants/model-names')

const ActivityLog = Schema({

    subject: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'subjectModel',
    },

    subjectModel: {
        type: String,
        required: true,
        enum: ['accounts', 'Drivers', 'Users', 'System'],
    },

    action: { type: String, required: true },

    actionCode: { type: String, required: true },

    url: { type: String },

    resource: {
        type: Schema.Types.ObjectId,
        required: false,
        refPath: 'resourceModel'
    },
    resourceModel: {
        type: String,
        required: false,
        enum: [
            MODELS.ACCOUNTS,
            MODELS.CITIES,
            MODELS.CORPORATES,
            MODELS.CORPORATE_PAYMENTS,
            MODELS.DEVICE_BAN,
            MODELS.DRIVERS,
            MODELS.EMPLOYEES,
            MODELS.FAVORITE_PLACES,
            MODELS.INCENTIVES,
            MODELS.LOANS,
            MODELS.LOGS,
            MODELS.MOCK_REPORTS,
            MODELS.NOTIFICATION,
            MODELS.POOLS,
            MODELS.PROMOS,
            MODELS.RENTS,
            MODELS.RENT_REQUESTS,
            MODELS.RENT_SEARCHES,
            MODELS.REWARDS,
            MODELS.REWARD_PACKAGES,
            MODELS.REWARD_PRIZES,
            MODELS.RIDES,
            MODELS.SETTING,
            MODELS.SOS,
            MODELS.TICKETS,
            MODELS.TOKENS,
            MODELS.TRIP_REQUESTS,
            MODELS.TRIP_SEARCHES,
            MODELS.USERS,
            MODELS.VEHICLES,
            MODELS.VEHICLE_TYPES,
            MODELS.VOUCHERS,
            MODELS.WALLET_HISTORIES,
        ]
    },
},
    {
        timestamps: true,
        capped: {
            size: 10737418240,
            autoIndexId: true
        },
    })

// ActivityLog.index({
//     action: "text"
// })

module.exports = mongoose.model(MODELS.ACTIVITY_LOGS, ActivityLog);