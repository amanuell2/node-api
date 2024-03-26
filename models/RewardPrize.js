const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const RewardPrize = Schema({
    initialAmountInStock: {
        type: Number,
        min: [0, "can not be negative"],
        required: true
    },
    amountInStock: {
        type: Number,
        min: [0, "can not be negative"],
        default: function () {
            return this.initialAmountInStock
        }
    },
    prizeItem: {
        type: String,
        required: true,
        unique: true,
    },
    prizeImage: {
        type: String
    },
},
    {
        timestamps: true
    })

RewardPrize.pre('updateOne', function (next) {
    const data = this.getUpdate()

    if (data.initialAmountInStock)
        data.amountInStock = data.initialAmountInStock
    this.updateOne({}, data).exec()
    next()
})


module.exports = mongoose.model(MODELS.REWARD_PRIZES, RewardPrize);