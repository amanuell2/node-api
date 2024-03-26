const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MODELS = require('../constants/model-names')

const MockReport = Schema({
    driver: {
        type: Schema.Types.ObjectId,
        ref: 'Drivers'
    },
},
    {
        timestamps: true
    })

module.exports = mongoose.model(MODELS.MOCK_REPORTS, MockReport);