const Setting = require('../../../models/Setting')
const { getNearbyPools } = require('../../core')
const { emitToPassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')

const schema = {
  type: "object",
  properties: {
    pickUpAddress: { type: "object" },
  },
  required: ['pickUpAddress'],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {
  try {
    await sanitizeInputs(schema, data)

    const setting = await Setting.findOne()
    console.log('fetching nearby pools')

    const pools = await getNearbyPools({ location: data.pickUpAddress, distance: setting.nearByPoolsSearchDistance, limit: setting.nearByPoolsSearchLimit })
    emitToPassenger(passenger._id)('nearByPools', pools)
  } catch (error) {
    console.log(error)
  }
}
