const { updateRentRequest, getRentRequest, getActiveRentRequestsByDispatcher } = require('../../utils/rent-request')
const { updateRentSearch, getRentSearch } = require('../../utils/rent-search')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const { emitToPassenger, notifyPassenger } = require('../../utils/passenger')
const { emitToDriver } = require('../../utils/driver')
const { emitToDispatcher, updateDispatcher } = require('../../utils/dispatcher')

const passengerTasks = require('../../../jobs/passenger')

const Rent = require('../../../models/Rent')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const RENT_STATUS = require('../../../constants/rent-statuses')
const TRIP_SEARCH_STATUS = require('../../../constants/trip-search-statuses')
const Setting = require('../../../models/Setting')
const RentRequest = require('../../../models/RentRequest')

const schema = {
  type: "object",
  properties: {
    rentRequestId: { type: "string" },
    status: { type: "string" },
  },
  required: ["rentRequestId", "status"],
  additionalProperties: false
}

module.exports = async (request, driver, vehicle, socket) => {
  // TODO: add validation to check only the driver himself is allowed to do this
  try {
    await sanitizeInputs(schema, request)
    // await updateRent({ passenger: request.passengerId, driver: request.driverId })({ status: request.status })




    const { status } = request

    const rentRequest = await getRentRequest(request.rentRequestId)

    if (status === REQUEST_STATUS.DECLINED) {

      if (rentRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        await updateVehicle(vehicle._id)({
          online: true,
          // rentRequestId: null
        })
        await emitToDriver(rentRequest.driver)('requestCanceled')
        return
      }

      await updateVehicle(vehicle._id)({
        online: true,
        // rentRequestId: null
      })
      await updateRentRequest(rentRequest._id)({ status: REQUEST_STATUS.DECLINED, active: false })

      if (rentRequest.targetedDispatch) {

        // await updateDispatcher(rentRequest.dispatcher)({ tripSearchId: null })
        if (rentRequest.dispatcher) {
          emitToDispatcher(rentRequest.dispatcher)('rentSearch', {
            status: "SINGLE_DRIVER"
          })

          const activeRequestsDispatched = await getActiveRentRequestsByDispatcher(rentRequest.dispatcher)
          emitToDispatcher(rentRequest.dispatcher)('rentRequests', activeRequestsDispatched)          
        }

        await emitToDriver(rentRequest.driver)('requestCanceled')

      } else {
        const task = await getRentSearch(rentRequest.rentSearchId)
        const setting = await Setting.findOne()
        await passengerTasks.skipSearchingForRents(task, `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`)
        await emitToDriver(rentRequest.driver)('requestCanceled')
        console.log(">><<<>>>><")
        console.log(rentRequest)
        if (rentRequest.dispatcher) {
          emitToDispatcher(rentRequest.dispatcher)('rentSearch', task)
          emitToDispatcher(rentRequest.dispatcher)('rentRequests', await RentRequest.find({
            rentSearchId: task._id
          }).populate('passenger', 'firstName lastName').populate('driver', 'firstName lastName'))
        }
      }

      // emitToPassenger(rentRequest.passenger)('requestCanceled')
    } else if (status === REQUEST_STATUS.ACCEPTED) {

      // console.log("\n\n\n\n\===============================================")
      // console.log(rentRequest.status)
      // console.log("\n\n\n\n\===============================================")

      // TODO: return requestCanceled in here?
      if (rentRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        await updateVehicle(vehicle._id)({
          online: true,
          // rentRequestId: null
        })
        return
      }

      await updateRentRequest(rentRequest._id)({ status: REQUEST_STATUS.ACCEPTED, active: false })

      await updateRentSearch(rentRequest.rentSearchId)({ active: false, status: TRIP_SEARCH_STATUS.COMPLETED })

      if (rentRequest.targetedDispatch) {
        // await updateDispatcher(rentRequest.dispatcher)({ tripSearchId: null })
        if (rentRequest.dispatcher) {
          emitToDispatcher(rentRequest.dispatcher)('rentSearch', {
            status: "SINGLE_DRIVER"
          })
          const activeRequestsDispatched = await getActiveRentRequestsByDispatcher(rentRequest.dispatcher)
          emitToDispatcher(rentRequest.dispatcher)('rentRequests', activeRequestsDispatched)
        }
      }
      else if (rentRequest.rentSearchId) {
        const task = await getRentSearch(rentRequest.rentSearchId)
        await passengerTasks.stopSearchingForRents(task)

        if (rentRequest.dispatcher) {
          task.status = TRIP_SEARCH_STATUS.COMPLETED
          emitToDispatcher(rentRequest.dispatcher)('rentSearch', task)
          emitToDispatcher(rentRequest.dispatcher)('rentRequests', await RentRequest.find({
            rentSearchId: task._id
          }).populate('passenger', 'firstName lastName').populate('driver', 'firstName lastName'))
        }
      }


      try {
        const rent = await Rent.create({
          passenger: rentRequest.passenger,
          driver: rentRequest.driver,
          pickUpAddress: rentRequest.pickUpAddress,
          note: rentRequest.note,
          duration: rentRequest.duration,
          vehicleType: rentRequest.vehicleType,
          vehicle: rentRequest.vehicle,
          active: true,
          status: RENT_STATUS.ACCEPTED
        })

        if (rent) {

          await updateVehicle({ _id: rentRequest.vehicle }, {
            online: false,
            // rentId: rent._id
          })

          const createdRent = await Rent.findById(rent._id).populate('driver').populate('passenger', 'firstName lastName phoneNumber _id emergencyContactNumber profileImage').populate('vehicleType').populate('vehicle')

          if (createdRent) {

            emitToPassenger(rentRequest.passenger)('rent', createdRent)
            notifyPassenger(rentRequest.passenger)({ title: 'Rent accepted', body: "Driver is on the way" })

            emitToDriver(rentRequest.driver)('rent', createdRent)

          }
        }
      } catch (error) {
        console.log(error)
      }

    }
  } catch (error) {
    console.log(error)
  }
}
