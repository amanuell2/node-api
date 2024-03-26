const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const Reward = Schema({
    passenger: {
        type: Schema.Types.ObjectId,
        ref: 'Users'
    },
    prize: {
        type: Schema.Types.ObjectId,
        ref: 'RewardPrizes'
    },
    status: {
        type: String,
        default: "ISSUED"
    },
},
    {
        timestamps: true
    })

module.exports = mongoose.model(MODELS.REWARDS, Reward);