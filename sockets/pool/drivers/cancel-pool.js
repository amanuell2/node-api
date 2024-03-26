const Pool = require('../../../models/Pool')
const { ObjectId } = require('mongoose').Types
const { emitToPassenger, updatePassenger } = require('../../utils/passenger')
const { updateVehicle } = require('../../utils/vehicle')
const { sanitizeInputs } = require('../../utils/core')
const POOL_STATUS = require('../../../constants/pool-statuses')

const activityLogger = require('../../../services/activity-logger')


const schema = {
  type: "object",
  properties: {
  },
  required: [],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    // await sanitizeInputs(schema, data)

    const pool = await Pool.findOne({
      driver: ObjectId(driver._id),
      status: { $nin: [POOL_STATUS.CANCELLED, POOL_STATUS.ENDED] }
    }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'you have not created a pool'
      })
      return
    }

    pool.status = POOL_STATUS.CANCELLED
    await pool.save()

    // await activityLogger.logActivity(activityLogger.POOL_HAS_BEEN_CANCELLED)({ driver: driver, vehicle: vehicle, pool: pool })

    await updateVehicle(vehicle._id)({ online: true, 
      // poolId: null
    })

    for (const passenger of pool.passengers) {
      await updatePassenger(passenger._id)({
        inActivePool: null,
        poolId: null
      })
      
      await emitToPassenger(passenger._id)('poolStatus', {
        status: POOL_STATUS.CANCELLED
      })
    }

    pool.passengers = []
    await pool.save()
    socket.emit('pool', pool)
    socket.emit('poolStatus', { status: POOL_STATUS.CANCELLED })
  } catch (error) {
    console.log(error)
  }

}
