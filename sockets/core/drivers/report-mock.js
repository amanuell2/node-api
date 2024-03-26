const MockReport = require('../../../models/MockReport')
const activityLogger = require('../../../services/activity-logger')
const { updateVehicle } = require('../../utils/vehicle')

const schema = {
    type: 'object',
    properties: {
    },
    required: [],
    additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
    try {
        // await sanitizeInputs(schema, data)
        await MockReport.create({
            driver: driver._id
        })

        socket.emit('mockReported')
        await updateVehicle(vehicle._id)({ online: false })
        // await activityLogger.logActivity(activityLogger.DRIVER_MOCK_REPORTED)({ driver: driver, vehicle: vehicle })

        console.log("mock reported: ", driver.phoneNumber)
    } catch (error) {
        console.log(`[DEBUG][ERROR] ${JSON.stringify(error)}`)
        socket.emit('error', error)
    }
}
