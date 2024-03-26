const Setting = require('../../../models/Setting')
const Vehicle = require('../../../models/Vehicle')
const { sanitizeInputs } = require('../../utils/core')
const { makeRequest } = require('../../../services/axios')
const RentSearch = require('../../../models/RentSearch')
const RentRequest = require('../../../models/RentRequest')
const { ObjectId } = require('mongoose').Types
const passengerTasks = require('../../../jobs/passenger')
const { updateDispatcher, emitToDispatcher } = require('../../utils/dispatcher')
const { getActiveRentRequestsByDispatcher } = require('../../utils/rent-request')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { emitToPassenger } = require('../../utils/passenger')
const { updateVehicle } = require('../../utils/vehicle')


const schema = {
  type: "object",
  properties: {
    pickUpAddress: { type: "object" },
    vehicleType: { type: "string" },
    duration: { type: "number" },
  },
  required: ['pickUpAddress', 'duration', 'vehicleType'],
  additionalProperties: true
}

module.exports = async (data, dispatcher, socket) => {
  try {
    await sanitizeInputs(schema, data)

    const setting = await Setting.findOne()


    const pua = {
      lat: 0,
      long: 0,
      name: ''
    }


    const value = await makeRequest({
      method: "get",
      url: 'https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.pickUpAddress.place_id + '&key=' + setting.mapKey
    })

    console.log(value)

    pua.name = data.pickUpAddress.name ? data.pickUpAddress.name : "-"
    pua.lat = value.data.results[0].geometry.location.lat
    pua.long = value.data.results[0].geometry.location.lng


    if (data.vehicle) {

      const vhcl = await Vehicle.findById(data.vehicle).populate('driver').populate('vehicleType')
      if (vhcl.online) {

        const request = await RentRequest.create({
          active: true,
          driver: vhcl.driver._id,
          passenger: data.passengerId,
  
          dispatcher: dispatcher._id,
          pickUpAddress: pua,
          vehicleType: vhcl.vehicleType,
          note: data.note ? data.note : '',
          vehicle: vhcl._id, 
          duration: data.duration,
          status: REQUEST_STATUS.IN_REQUEST,
          createdBy: "dispatcher", // TODO: check about this field
          rentSearchId: null,
          targetedDispatch: true
        })
  
  
        await updateDispatcher(dispatcher._id)({ tripSearchId: "SINGLE_DRIVER_RENT" })

        await emitToPassenger(data.passengerId)('rentRequest', request)
    
        socket.emit("rentSearch", {status: "SINGLE_DRIVER"})
        const activeRequestsDispatched = await getActiveRentRequestsByDispatcher(dispatcher._id)
        emitToDispatcher(dispatcher._id)('rentRequests', activeRequestsDispatched)

        await emitToDriver(vhcl.driver._id)('rentRequest', request)
        await notifyDriver(vhcl.driver._id)({ title: 'Rent request', body: 'You have a new rent request' })
  
        await updateVehicle(vhcl._id)({ online: false, lastTripTimestamp: new Date(),
          //  rentRequestId: request._id 
           }) // TODO: check if last trip timestamp should be updated
  

        await passengerTasks.expireRentRequest(
          request._doc,
          `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
        )

      }
      // await updateDispatcher(dispatcher._id)({ tripSearchId: null })
      socket.emit('searching')
    } else {




      const rentSearch = await RentSearch.create({
        active: true,
        passenger: data.passengerId,
        requestedVehicles: [],
        pickUpAddress: pua,
        vehicleType: data.vehicleType,
        note: data.note ? data.note : '',
        duration: data.duration,
        note: String,
        createdBy: 'dispatcher',
        dispatcher: dispatcher._id,
      })

      await updateDispatcher(dispatcher._id)({ rentSearchId: rentSearch._id })

      socket.emit('searchingRent')
      socket.emit('rentSearch', rentSearch)


      console.log(rentSearch)

      await passengerTasks.startSearchingForRents(
        rentSearch,
        `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
      )

    }
  } catch (error) {
    console.log(error)
  }
}
