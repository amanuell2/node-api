const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')

const EmployeeSchema = Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  corporate: {
    type: Schema.Types.ObjectId,
    ref: 'Corporates',
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
},
{
  timestamps: true
}
)

module.exports = mongoose.model(MODELS.EMPLOYEES, EmployeeSchema)
