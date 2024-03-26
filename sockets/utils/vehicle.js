const Vehicle = require('../../models/Vehicle')
const { ObjectId } = require('mongoose').Types

const updateVehicle = (vehicleId) => async (changes) => {
  try {
    await Vehicle.updateOne({ _id: ObjectId(vehicleId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  updateVehicle
}
