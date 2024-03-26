const Setting = require('../../../models/Setting')
const RentSearch = require('../../../models/RentSearch')
const RentRequest = require('../../../models/RentRequest')
const Passenger = require('../../../models/User')
const passengerTasks = require('../../../jobs/passenger')

const { makeRequest } = require('../../../services/axios')
const { default: Axios } = require('axios')
const { updateDispatcher, emitToDispatcher } = require('../../utils/dispatcher')
const { updateVehicle } = require('../../utils/vehicle')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { notifyPassenger, emitToPassenger } = require('../../utils/passenger')
const { getActiveRequestsByDispatcher } = require('../../utils/trip-request')

const TRIP_SEARCH_STATUSES = require('../../../constants/trip-search-statuses')
const { ObjectId } = require('mongoose').Types

// const { searchForDispatcher } = require('../../core')

module.exports = async (data, dispatcher, socket) => {
    console.log(">>", data)
    if (data && data.rentSearchId) {
        const rentSearch = await RentSearch.findOne({
            active: true,
            _id: ObjectId(data.rentSearchId)
        })

        if (rentSearch) {
            // TODO: move those actions to stopSearchingForRides
            rentSearch.status = TRIP_SEARCH_STATUSES.CANCELLED
            rentSearch.cancelledBy = 'Dispatcher'
            // rentSearch.cancelledReason = req.body.reason ? req.body.reason : ''
            rentSearch.active = false
            // rentSearch.dispatcherWhoCancelled = dispatcher._id
            await rentSearch.save()

            socket.emit('rentSearch', rentSearch)

            const activeRequests = await RentRequest.find({
                active: true,
                rentSearchId: rentSearch._id
            })

            await passengerTasks.stopSearchingForRents(rentSearch)

            for (const activeRequest of activeRequests) {

                activeRequest.cancelledBy = 'Dispatcher'
                // activeRequest.cancelledReason = req.body.reason ? req.body.reason : ''
                activeRequest.active = false
                // activeRequest.dispatcherWhoCancelled = dispatcher._id
                await activeRequest.save()

                await updateVehicle(activeRequest.vehicle)({ online: true,
                    // tripRequestId: null
                })

                await emitToDriver(activeRequest.driver)('requestCanceled')
                await notifyDriver(activeRequest.driver)({ title: 'Request Canceled', body: 'Request has been cancelled' })
            }
            await emitToPassenger(rentSearch.passenger)('requestCanceled')
            await notifyPassenger(rentSearch.passenger)({ title: 'Request Canceled', body: 'Request has been cancelled' })

            // const activeRequestsDispatched = await getActiveRequestsByDispatcher(dispatcher._id)
            // socket.emit('requests', activeRequestsDispatched)

            socket.emit('rentRequests', await RentRequest.find({
                rentSearchId: rentSearch._id
              }).populate('passenger', 'firstName lastName').populate('driver', 'firstName lastName'))

            // socket.emit('searching')

        } else {
            console.log("rent search not found or is not retryable")
            socket.emit('err', "rentsearch not found or is non retryable")
        }
    } else {
        console.log('Invalid Data!')
    }

}