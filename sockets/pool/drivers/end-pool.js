const Pool = require('../../../models/Pool')
const {ObjectId} = require('mongoose').Types
const { sanitizeInputs } = require('../../utils/core')
const { updatePool } = require('../../utils/pool')
const { updateVehicle } = require('../../utils/vehicle')
const { emitToDriver } = require('../../utils/driver')

const schema = {
  type: "object",
  properties: {
    poolId: { type: "string" },
  },
  required: ["poolId"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)

    let pool = await Pool.findOne({ _id: ObjectId(data.poolId), poolEnded: false })

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }
    
    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    if (pool.active) {
        socket.emit('error', {
          type: 'pool',
          message: 'pool trips must be ended before ending the pool'
        })
        return
      }
  

    await updatePool(pool._id)({ poolEnded: true })

    await updateVehicle(vehicle._id)({ online: true,
      // tripId: null
    })

    await emitToDriver(driver._id)('status', { status: true })


    socket.emit('pool', await Pool.findById(pool._id).populate({ 
        path: 'trips',
        populate: {
          path: 'passenger',
          model: 'Users'
        } 
     }).populate('vehicleType'))

  } catch (error) {
    console.log(error)
  }
}