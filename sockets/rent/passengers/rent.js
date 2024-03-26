const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { makeRequest } = require('../../../services/axios')
const RentSearch = require('../../../models/RentSearch')
const { ObjectId } = require('mongoose').Types
const passengerTasks = require('../../../jobs/passenger')


const schema = {
  type: "object",
  properties: {
    pickUpAddress: { type: "object" },
    vehicleType: { type: "string" },
    duration: { type: "number" },
  },
  required: ['pickUpAddress', 'duration', 'vehicleType'],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {
  try {
    await sanitizeInputs(schema, data)


    // // TODO: make sure this can be done while in pool
    // if (passenger.inActivePool) {
    //   socket.emit('error', {
    //     type: 'pool',
    //     message: 'action not allowed while in a pool'
    //   })
    //   return
    // }


    // const activeRentSearch = await RentSearch.findOne({
    //   active: true,
    //   passenger: ObjectId(passenger._id)
    // })

    // if (activeRentSearch) {
    //   socket.emit('error', {
    //     type: 'request',
    //     message: 'you already are requesting rent'
    //   })
    //   return
    // }


    const setting = await Setting.findOne()
    
    // const vehicleTypeData = await VehicleType.findById(data.vehicleType)



    if (!data.pickUpAddress.name) {
      pickup = makeRequest({
        method: "get",
        url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.pickUpAddress.lat + ',' + data.pickUpAddress.long + '&key=' + setting.mapKey
      })
    } else {
      pickup = data.pickUpAddress
    }


    const value = await Promise.resolve(pickup)
    if (!data.pickUpAddress.name) {
      if (value.status == 200 && value.data.status == 'OK') {
        data.pickUpAddress.name = value.data.results[0].formatted_address
      } else {
        data.pickUpAddress.name = '_'
      }
    }


    const rentSearch = await RentSearch.create({
      active: true,
      passenger: passenger._id,
      requestedVehicles: [],
      pickUpAddress: data.pickUpAddress,
      vehicleType: data.vehicleType,
      note: data.note ? data.note : '',
      duration: data.duration,
      note: String,
    })

    console.log(rentSearch)

    await passengerTasks.startSearchingForRents(
      rentSearch,
      `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
    )






    // async function sendRequest() {
    //   let vehicle
    //   const removedDrivers = []
    //   let vehicles = []
    //   vehicles = JSON.parse(await getNearbyDrivers({ location: data.pickUpAddress, distance: setting.searchRadius ? setting.searchRadius * 1000 : 10000 }))

    //   vehicles.forEach((v) => {
    //     if (!requestedDrivers.includes(v._id) && vehicle == null && v.driver && ((vehicleTypeData && vehicleTypeData.name && vehicleTypeData.name.toLowerCase() == 'any') ? true : v.vehicleType == data.vehicleType)) {
    //       vehicle = v
    //       requestedDrivers.push(v._id)
    //     }
    //   })

    //   if (vehicle) {
    //     const rentObject = new RentObject({
    //       passengerId: id,
    //       driverId: vehicle.driver && vehicle.driver._id ? vehicle.driver._id : vehicle.driver,
    //       driver: vehicle.driver,
    //       startTimestamp: data.startTimestamp,
    //       note: data.note ? data.note : '',
    //       endTimestamp: data.endTimestamp,
    //       pickUpAddress: {
    //         name: pickUpAddress.name,
    //         coordinate: {
    //           lat: pickUpAddress.lat,
    //           long: pickUpAddress.long
    //         }
    //       },
    //       vehicleId: vehicle._id,
    //       vehicleType: vehicleTypeData,
    //       status: 'inRequest',
    //       timestamp: new Date().getTime(),
    //       updateCallback
    //     })

    //     addRent({ newRent: rentObject })
    //     socket.emit('rentRequest', rentObject)

    //     emitToDriver(rentObject.driver)('rentRequest', rentObject)
    //     notifyDriver(rentObject.driverId)({ title: 'Rent request', body: 'You have new rent request' })

    //     Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: false }, (err, res) => { })

    //     setTimeout(() => {
    //       if (!driverFound && !canceled && !removedDrivers.includes(rentObject.driverId)) {
    //         removedDrivers.push(rentObject.driverId)
    //         updateRent({ passengerId: rentObject.passengerId, driverId: rentObject.driverId, status: 'Expired' })
    //         sendRequest()
    //       }
    //     }, setting && setting.requestTimeout ? setting.requestTimeout * 1000 : 10000)
    //   } else {
    //     canceled = true
    //     socket.emit('noAvailableDriver')
    //   }
    // }

    // function updateCallback(rentObject) {
    //   if (!driverFound && !canceled) {
    //     const status = rentObject.getStatus()

    //     if (status == 'Declined') {
    //       emitToDriver(rentObject.driverId)('requestCanceled')
    //       if (!removedDrivers.includes(request.driverId)) {
    //         removedDrivers.push(request.driverId)
    //         sendRequest()
    //       }
    //       Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
    //     } else if (status == 'Expired') {
    //       emitToDriver(rentObject.driverId)('requestExpired')
    //       Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
    //     } else if (status == 'Canceled') {
    //       emitToDriver(rentObject.driverId)('requestCanceled')
    //       canceled = true
    //       emitToPassenger(rentObject.passengerId)('requestCanceled')
    //       Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
    //     } else if (status == 'Accepted' && !driverFound && !canceled) {
    //       driverFound = true
    //       try {
    //         Rent.create({
    //           passenger: rentObject.passengerId,
    //           driver: rentObject.driverId,
    //           pickUpAddress: rentObject.pickUpAddress,
    //           note: rentObject.note,
    //           vehicleType: rentObject.vehicleType._id,
    //           vehicle: rentObject.vehicleId,
    //           active: true,
    //           status: 'Accepted'
    //         }, (error, rent) => {
    //           if (error) console.log({ rent })
    //           if (rent) {
    //             Rent.findById(rent._id, async (error, createdRent) => {
    //               if (error) console.log({ error })
    //               if (createdRent) {
    //                 emitToPassenger(id)('rent', createdRent)
    //                 notifyPassenger(id)({ title: 'Rent accepted', body: 'Driver is on the way' })

    //                 emitToDriver(rentObject.driverId)('rent', createdRent)

    //                 Vehicle.updateMany({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
    //               }
    //             }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    //           }
    //         })
    //       } catch (error) {
    //         console.log({ error })
    //       }
    //     }
    //   } else {
    //     emitToDriver(rentObject.driverId)('requestExpired')
    //     Vehicle.updateOne({ _id: request.vehicleId }, { online: true }, (err, res) => { })
    //   }
    // }
  } catch (error) {
    console.log(error)
  }
}
