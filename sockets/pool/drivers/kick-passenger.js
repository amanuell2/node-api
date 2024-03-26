const Pool = require('../../../models/Pool')
const Passenger = require('../../../models/User')
const { sanitizeInputs } = require('../../utils/core')
const { emitToDriver } = require('../../utils/driver')
const { updatePassenger, emitToPassenger } = require('../../utils/passenger')
const POOL_STATUS = require('../../../constants/pool-statuses')
const activityLogger = require('../../../services/activity-logger')
const { ObjectId } = require('mongoose').Types

const schema = {
  type: 'object',
  properties: {
    passengerId: { type: "string" },
  },
  required: ["passengerId"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)

    const pool = await Pool.findOne({
      driver: driver._id,
      status: POOL_STATUS.CREATED
    }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'you have not created a pool'
      })
      return
    }

    const poolMemberToKickOut = await Passenger.findOne({
        _id: ObjectId(data.passengerId),
        inActivePool: true,
        poolId: pool._id
    })

    if (!poolMemberToKickOut) {
        socket.emit('error', {
            type: 'pool',
            message: 'the passenger does not exist in the pool'
          })
          return
    }

    await pool.passengers.pull({ _id: ObjectId(poolMemberToKickOut._id) })

    await pool.save()

    await updatePassenger(poolMemberToKickOut._id)({
        inActivePool: false,
        poolId: null
    })

    // await activityLogger.logActivity(activityLogger.POOL_HAS_ENDED)({ driver: driver, vehicle: vehicle, pool: pool })

    await emitToDriver(pool.driver._id)('pool', pool)
    pool.passengers.forEach(member => {
        emitToPassenger(member._id)('pool', pool)
    })

    await emitToPassenger(poolMemberToKickOut._id)('kickedFromPool')

  } catch (error) {
    console.log(error)
  }

}
