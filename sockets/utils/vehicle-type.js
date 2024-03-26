const VehicleType = require('../../models/VehicleType')

const getVehicleType = async (vehicleTypeId) => {
  return await VehicleType.findById(vehicleTypeId)
}

module.exports = {
  getVehicleType
}
