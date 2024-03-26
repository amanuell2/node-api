const { updateTripRequest, getActiveRequestByDriverAndPassenger } = require('../../utils/trip-request')

module.exports = async (data, dispatcher, socket) => {
    const tripRequest = await getActiveRequestByDriverAndPassenger(data.driverId, data.passengerId)
    await updateTripRequest(tripRequest._id)({ status: 'Canceled' }) // TODO: fix the 'canceled' typo..
}