const Driver = require('../../../models/Driver')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const activityLogger = require('../../../services/activity-logger')
const DriverStat = require('../../../models/DriverStat')
const { ObjectId } = require('mongoose').Types

const schema = {
  type: 'object',
  properties: {
    status: { type: 'boolean' }
  },
  required: ['status'],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)

    if (vehicle) {
      try {
        await updateVehicle(vehicle._id)({ online: data.status, statusChangedIntentionally: true, lastPingTimestamp: new Date() })
        // const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][(new Date()).getDay()]
        // try {

        //   const stat = await DriverStat.findOne({
        //     vehicle: ObjectId(vehicle._id)
        //   })
        //   let update = {
        //     [dow + '.lastUpdatedAt'] : new Date()
        //   }
        //   if (data.status) {
        //     update.$inc = {
        //       [dow + '.onlineHours']: new Date() - new Date(stat[dow].lastUpdatedAt)
        //     } 
        //   }
        //   if (stat) {
        //     DriverStat.updateOne({
        //       vehicle: ObjectId(vehicle._id)
        //     }, update)
        //   } else {
        //     DriverStat.create({
        //       vehicle: ObjectId(vehicle._id),
        //       driver: ObjectId(driver._id),
        //       [dow]: { onlineHours: 0, lastUpdatedAt: new Date() }
        //     })
        //   }
        // } catch (error) {
        //   console.log(error)
        // }
        // await activityLogger.logActivity(data.status ? activityLogger.DRIVER_HAS_BECOME_ONLINE : activityLogger.DRIVER_HAS_BECOME_OFFLINE)({ driver: driver, vehicle: vehicle })
        socket.emit('status', { status: data.status })
      } catch (error) {
        console.log(error)
      }
    } else {
      socket.emit('error', 'you do not own a registered car')
    }
  } catch (error) {
    console.log(`[DEBUG][ERROR] ${JSON.stringify(error)}`)
    socket.emit('error', error)
  }
}
