const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const RewardPackage = Schema({
    prizes: [{
        type: Schema.Types.ObjectId,
        ref: 'RewardPrizes'
    }],
    minimumWalletAmountToQualify: {
        type: Number,
        required: true,
        min: [1, "must at least be 1 Birr"]
    },
    name: {
        type: String,
        unique: true,
    }
},
    {
        timestamps: true
    })

module.exports = mongoose.model(MODELS.REWARD_PACKAGES, RewardPackage);