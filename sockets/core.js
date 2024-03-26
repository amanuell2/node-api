const Vehicle = require('../models/Vehicle')
const Pool = require('../models/Pool')
const Setting = require('../models/Setting')
const { makeRequest } = require('../services/axios')


function getNearbyPools({ location, distance, limit, exclude, poolSearch }) {
  if (!limit) { limit = 10 }
  if (!exclude) { exclude = [] }

  return new Promise((resolve, reject) => {
    if (distance && location) {
      Pool.find({
        active: true,
        // status: {
        //   $in: [
        //     POOL_STATUS.CREATED,
        //     POOL_STATUS.STARTED
        //   ]
        // },
        position: {
          $near: {
            $maxDistance: distance,
            $geometry: {
              type: 'Point',
              coordinates: [location.long, location.lat]
            }
          }
        },
        driver: {
          $nin: exclude
        },
      }, async (err, res) => {
        if (err) return reject(err)
        if (res) {
          const setting = await Setting.findOne({})

          const pools = await Promise.all(res.filter(x => ((x.distance * 1000) / x.totalDistance) < 0.8).map(async (pool) => {
            const distanceInKM = calculateDistance(location, pool.pickUpAddress)
            radiusInKM = distance / 1000
            const point = (((radiusInKM - distanceInKM) * 100) / radiusInKM)

            const currentPosition = {
              lat: pool.position.coordinates[1],
              long: pool.position.coordinates[0],
            }

            let divergence = 1000000;
            
            const [route1, route2] = await Promise.all([
              makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${pool.dropOffAddress.lat},${pool.dropOffAddress.long}&waypoints=${poolSearch.pickUpAddress.lat},${poolSearch.pickUpAddress.long}|${poolSearch.dropOffAddress.lat},${poolSearch.dropOffAddress.long}&key=${setting.mapKey}` }),
              makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${poolSearch.dropOffAddress.lat},${poolSearch.dropOffAddress.long}&waypoints=${poolSearch.pickUpAddress.lat},${poolSearch.pickUpAddress.long}|${pool.dropOffAddress.lat},${pool.dropOffAddress.long}&key=${setting.mapKey}` }),
            ])
            
            if (route1.data.status == "OK" && route2.data.status == "OK") {
              const distance1 = (route1.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
              const distance2 = (route2.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)

              if (distance1 < distance2) {
                const fromPositonToOriginalDestination = await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${pool.dropOffAddress.lat},${pool.dropOffAddress.long}&key=${setting.mapKey}` })

                if (fromPositonToOriginalDestination.data.status != "OK") {
                  return
                }
                divergence = Math.abs(distance1 - fromPositonToOriginalDestination.data.routes[0].legs[0].distance.value)
              } else {

                const fromPositonToNewDestination = await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${poolSearch.dropOffAddress.lat},${poolSearch.dropOffAddress.long}&key=${setting.mapKey}` })

                if (fromPositonToNewDestination.data.status != "OK") {
                  return
                }

                divergence = Math.abs(distance2 - fromPositonToNewDestination.data.routes[0].legs[0].distance.value)
              }

              console.log("DIVERGENCE:", divergence)

            }

            return {
              _id: pool._id,
              size: pool.size,
              distance: distanceInKM,
              position: pool.position,
              driver: pool.driver,
              vehicle: pool.vehicle,
              vehicleType: pool.vehicleType,
              divergence,
              pickUpName: pool.pickUpAddress.name || 'unknown',
              dropOffName: pool.dropOffAddress.name || 'unknown',
              point
            }
          }))

          return resolve(pools.filter(x => x.divergence < setting.poolDivergence).sort((a, b) => (a.point > b.point) ? -1 : ((b.point > a.point) ? 1 : 0)).slice(0, limit))
        }
      }).populate('passengers', 'firstName lastName rating phoneNumber').populate('trips')
      // .populate('vehicle').populate('vehicleType').populate('driver')
    } else {
      return reject('Invalid location or distance')
    }
  })

  function calculateDistance(from, to) {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(to.lat - from.lat) // deg2rad below
    const dLon = deg2rad(to.long - from.long)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(from.lat)) * Math.cos(deg2rad(to.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180)
  }
}

async function getNearbyDrivers({ location, distance, limit, vehicleType, exclude, femaleOnlyRequired }) {

  // Default values
  if (!limit) { limit = 10000 }
  if (!exclude) { exclude = [] }

  // console.log("SEARCH PARAMS:", { location, distance, limit, vehicleType, exclude })
  if (distance && location) {
    var d = new Date();
    d.setMinutes(d.getMinutes() - 5);
    const filter = {
      online: true,
      active: true,
      _id: {
        $nin: exclude
      },
      lastPingTimestamp: { $gte: d },
      position: {
        $near: {
          $maxDistance: distance,
          $geometry: {
            type: "Point",
            coordinates: [location.long, location.lat]
          }
        }
      }
    }
    if (vehicleType) {
      filter.vehicleType = vehicleType
    }

    if (femaleOnlyRequired) {
      filter.isFemaleDriver = true;
    }

    const vehiclesFound = await Vehicle.find(filter, 'position vehicleType driver lastTripTimestamp').populate('driver')

    if (vehiclesFound) {
      const vehiclesNearby = vehiclesFound.map((vehicle) => {
        const distanceInKM = calculateDistance(location, { lat: vehicle.position.coordinates[1], long: vehicle.position.coordinates[0] })
        radiusInKM = distance / 1000
        let point = (((radiusInKM - distanceInKM) * 100) / radiusInKM)

        const currentTime = new Date()
        const lastWorkTime = vehicle.lastTripTimestamp

        if (distanceInKM < 0.2) {
          point = (currentTime - lastWorkTime)
        }

        return {
          _id: vehicle._id,
          driver: vehicle.driver,
          vehicleType: vehicle.vehicleType,
          distance: distanceInKM,
          position: vehicle.position,
          point,
          // estimatedArrivalTime: (distanceInKM / 40) // TODO: assuming 40Kmph
        }
      })
      return JSON.stringify(vehiclesNearby.sort((a, b) => (a.point > b.point) ? -1 : ((b.point > a.point) ? 1 : 0)).slice(0, limit))
    }
  } else {
    throw new Error('Invalid location or distance')
  }

  function calculateDistance(from, to) {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(to.lat - from.lat) // deg2rad below
    const dLon = deg2rad(to.long - from.long)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(from.lat)) * Math.cos(deg2rad(to.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180)
  }
}

// const searchForDispatcher = async (socket, data) => {
//   const io = getIO()
//   const setting = await Setting.findOne()
//   let type = 'normal'
//   if (data.type && data.type != undefined) {
//     type = data.type
//   }
//   const requestedDrivers = []
//   let driverFound = false
//   let canceled = false
//   let passengerId = ''
//   let passenger = null
//   let schedule = null
//   let corporate = false

//   let requestCount = 1
//   if (type == 'bid' && setting.bidDriversPerRequest && setting.bidDriversPerRequest > 1) {
//     requestCount = setting.bidDriversPerRequest
//   }
//   let sentRequestCount = 0
//   let receivedResponse = 0
//   let vehicleTypeData

//   if (data.vehicleTypeData) {
//     vehicleTypeData = data.vehicleTypeData
//   } else {
//     vehicleTypeData = await VehicleType.findById(data.vehicleType)
//   }

//   if (data.schedule && data.schedule != undefined) {
//     schedule = new Date(data.schedule)
//   }

//   if (data.ticket && data.ticket != undefined) corporate = true

//   const pua = {
//     lat: 0,
//     long: 0,
//     name: ''
//   }

//   const doa = {
//     lat: 0,
//     long: 0,
//     name: ''
//   }

//   let route

//   if (data.passengerId) {
//     passengerId = data.passengerId
//     if (data.passenger) {
//       passenger = data.passenger
//     } else {
//       passenger = await User.findById(data.passengerId)
//     }
//   } else {
//     passenger = await User.findOne({ phoneNumber: data.phone })
//     if (passenger) {
//       passengerId = passenger._id
//     } else {
//       const newPassenger = await User.create({ phoneNumber: data.phone, firstName: data.name ? data.name : '_', lastName: '_' })
//       if (newPassenger) {
//         passenger = newPassenger
//         passengerId = newPassenger._id
//       }
//     }
//   }

//   if (data.route && data.pickUpAddress.name && data.dropOffAddress.name && data.pickUpAddress.coordinate && data.dropOffAddress.coordinate) {
//     route = data.route
//     doa.name = data.dropOffAddress.name
//     doa.lat = data.dropOffAddress.coordinate.lat
//     doa.long = data.dropOffAddress.coordinate.long
//     pua.name = data.pickUpAddress.name
//     pua.lat = data.pickUpAddress.coordinate.lat
//     pua.long = data.pickUpAddress.coordinate.long
//     sendRequest()
//   } else if (data.pickUpAddress && data.pickUpAddress.place_id && data.pickUpAddress.name && data.dropOffAddress && data.dropOffAddress.name && data.dropOffAddress.place_id) {
//     const pickup = Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.pickUpAddress.place_id + '&key=' + setting.mapKey)

//     const dropOff = Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.dropOffAddress.place_id + '&key=' + setting.mapKey)

//     Promise.all([pickup, dropOff]).then(value => {
//       if (value[0].status == 200 && value[0].data.status == 'OK') {
//         pua.name = data.pickUpAddress.name
//         pua.lat = value[0].data.results[0].geometry.location.lat
//         pua.long = value[0].data.results[0].geometry.location.lng
//       } else {
//         pua.name = '_'
//       }

//       if (value[1].status == 200 && value[1].data.status == 'OK') {
//         doa.name = data.dropOffAddress.name
//         doa.lat = value[1].data.results[0].geometry.location.lat
//         doa.long = value[1].data.results[0].geometry.location.lng
//       } else {
//         doa.name = '_'
//       }

//       Axios.get('https://api.mapbox.com/directions/v5/mapbox/driving/' + pua.long + ',' + pua.lat + ';' + doa.long + ',' + doa.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw').then((routeObject) => {
//         if (routeObject && routeObject.data && routeObject.data.routes && routeObject.data.routes[0] && routeObject.data.routes[0].geometry && routeObject.data.routes[0].geometry.coordinates) {
//           route = { coordinates: routeObject.data.routes[0].geometry.coordinates, distance: routeObject.data.routes[0].distance, duration: routeObject.data.routes[0].duration }
//           sendRequest()
//         }
//       }).catch((error) => {
//         console.log({ error })
//       })
//     }).catch((error) => {
//       console.log({ error })
//     })
//   } else {
//     console.log('Invalid Data!')
//   }

//   async function sendRequest() {
//     sentRequestCount = 0
//     receivedResponse = 0
//     const removedDrivers = []
//     let vehicles = []

//     const availableVehicles = []

//     if (data.singleDriver) {
//       availableVehicles.push({ _id: data.vehicle, driver: data.driver })
//     } else {
//       vehicles = JSON.parse(await getNearbyDrivers({ location: pua, distance: schedule && setting.scheduleSearchRadius ? setting.scheduleSearchRadius * 1000 : setting.searchRadius ? setting.searchRadius * 1000 : 10000 }))

//       vehicles.forEach((v) => {
//         if (sentRequestCount < requestCount && !requestedDrivers.includes(v._id) && v.driver && ((vehicleTypeData && vehicleTypeData.name && vehicleTypeData.name.toLowerCase() == 'any') ? true : v.vehicleType == data.vehicleType)) {
//           availableVehicles.push(v)
//           requestedDrivers.push(v._id)
//           sentRequestCount += 1
//         }
//       })
//     }

//     if (availableVehicles.length > 0) {
//       const sentRequests = []
//       for (let index = 0; index < availableVehicles.length; index++) {
//         var request = new Request({
//           passengerId: passengerId,
//           passenger,
//           driverId: availableVehicles[index].driver && availableVehicles[index].driver._id ? availableVehicles[index].driver._id : availableVehicles[index].driver,
//           driver: availableVehicles[index].driver,
//           type,
//           dispatcherId: data.dispatcherId,
//           schedule,
//           vehicle: availableVehicles[index],
//           vehicleId: availableVehicles[index]._id,
//           bidAmount: data.bidAmount && type == 'bid' ? data.bidAmount : null,
//           pickUpAddress: {
//             name: pua.name,
//             coordinate: {
//               lat: pua.lat,
//               long: pua.long
//             }
//           },
//           route,
//           note: data.note ? data.note : '',
//           vehicleType: vehicleTypeData,
//           ticket: corporate ? data.ticket : null,
//           corporate,
//           createdBy: 'dispatcher',
//           dropOffAddress: {
//             name: doa.name,
//             coordinate: {
//               lat: doa.lat,
//               long: doa.long
//             }
//           },
//           status: 'inRequest',
//           timestamp: new Date().getTime(),
//           updateCallback
//         })
//         sentRequests.push(request)
//         addRequest({ newRequest: request })
//         socket.emit('searching')

//         const requests = getAllRequests('dispatcher')
//         const rents = getAllRents('dispatcher')

//         var rentAndRequests = [...requests, ...rents]

//         const dispatchers = getAllDispatchers()

//         dispatchers.forEach((dispatcher) => {
//           io.of('/dispatcher-socket').to(dispatcher.socketId).emit('requests', rentAndRequests)
//         })

//         socket.emit('request', request)
//         const driver = getDriver({ id: request.driverId })
//         if (driver) {
//           io.of('/driver-socket').to(driver.socketId).emit('request', request)
//           sendNotification(driver.fcm, { title: 'Request', body: 'You have new trip request' })
//           Vehicle.updateOne({ _id: request.vehicleId }, { online: false, lastTripTimestamp: new Date() }, (err, res) => { })
//         }
//       }

//       setTimeout(() => {
//         if (!canceled) {
//           sentRequests.forEach((request) => {
//             const r = getRequest({ passengerId: request.passengerId, driverId: request.driverId })
//             if (r && r.getStatus() != 'Accepted') {
//               updateRequest({ passengerId: request.passengerId, driverId: request.driverId, status: 'Expired' })
//             }
//           })
//           if (!driverFound && !data.singleDriver && !removedDrivers.includes(request.driverId)) {
//             removedDrivers.push(request.driverId)
//             sendRequest()
//           }
//         }
//       }, setting && setting.requestTimeout ? setting.requestTimeout * 1000 : 10000)
//     } else {
//       canceled = true
//       socket.emit('noAvailableDriver')
//     }
//   }

//   async function updateCallback(request) {
//     if (!driverFound && !canceled) {
//       const status = request.getStatus()
//       const requests = getAllRequests('dispatcher')
//       const rents = getAllRents('dispatcher')

//       let rentAndRequests = [...requests, ...rents]
//       if (status == 'Accepted') {
//         const filteredRequests = rentAndRequests.filter((r) => r.passenger != request.passenger)
//         rentAndRequests = filteredRequests
//         rentAndRequests.push(request)
//       }

//       const dispatchers = getAllDispatchers()

//       dispatchers.forEach((dispatcher) => {
//         io.of('/dispatcher-socket').to(dispatcher.socketId).emit('requests', rentAndRequests)
//       })
//       if (status == 'Declined') {
//         receivedResponse += 1
//         var driver = getDriver({ id: request.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestCanceled')
//         Vehicle.updateOne({ _id: request.vehicleId }, { online: true }, (err, res) => { })
//         if (!data.singleDriver && sentRequestCount <= receivedResponse && !removedDrivers.includes(request.driverId)) {
//           removedDrivers.push(request.driverId)
//           sendRequest()
//         }
//       } else if (status == 'Expired') {
//         var driver = getDriver({ id: request.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestExpired')
//         Vehicle.updateOne({ _id: request.vehicleId }, { online: true }, (err, res) => { })
//         // if (!data.singleDriver) {
//         //     sendRequest();
//         // }
//       } else if (status == 'Canceled') {
//         canceled = true
//         var driver = getDriver({ id: request.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestCanceled')

//         // var dispatcher = getDispatcher({ dispatcherId: id });
//         // if (dispatcher) io.of('/dispatcher-socket').to(dispatcher.socketId).emit('requestCanceled');
//       } else if (status == 'Accepted') {
//         if (!driverFound && !canceled) {
//           driverFound = true
//           let ticket
//           if (request.corporate && request.ticket) {
//             ticket = await Ticket.findById(request.ticket)
//             ticket.active = false
//             ticket.save()
//           }
//           try {
//             Ride.create({
//               driver: request.driverId,
//               passenger: request.passengerId,
//               vehicle: request.vehicleId,
//               type: request.type,
//               schedule: request.schedule,
//               corporate: ticket && ticket.corporate ? ticket.corporate : null,
//               bidAmount: request.bidAmount,
//               route: request.route,
//               note: request.note,
//               dispatcher: request.dispatcherId,
//               ticket: request.ticket,
//               pickUpAddress: request.pickUpAddress,
//               dropOffAddress: request.dropOffAddress,
//               vehicleType: request.vehicleType._id,
//               status: request.schedule ? TRIP_STATUS.SCHEDULED : TRIP_STATUS.ACCEPTED,
//               active: !request.schedule,
//               createdBy: 'dispatcher'
//             }, (error, ride) => {
//               if (error) console.log(error)
//               if (ride) {
//                 Ride.findById(ride._id, async (error, createdRide) => {
//                   if (error) console.log(error)
//                   if (createdRide) {
//                     addTrip(createdRide)

//                     const driver = getDriver({ id: request.driverId })
//                     if (driver) io.of('/driver-socket').to(driver.socketId).emit('trip', createdRide)

//                     Vehicle.updateOne({ _id: request.vehicleId }, { online: !!request.schedule }, (err, res) => { })
//                   }
//                 }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
//               }
//             })
//           } catch (error) {
//             console.log(error)
//           }
//         }
//       }
//     } else {
//       var driver = getDriver({ id: request.driverId })
//       if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestExpired')
//       Vehicle.updateOne({ _id: request.vehicleId }, { online: true }, (err, res) => { })
//     }
//   }
// }

// const rentForDispatcher = async (socket, data) => {
//   const io = getIO()
//   const setting = await Setting.findOne()
//   const requestedDrivers = []
//   let driverFound = false
//   let canceled = false
//   let passengerId = ''
//   let passenger = null
//   const vehicleTypeData = await VehicleType.findById(data.vehicleType)

//   const pua = {
//     lat: 0,
//     long: 0,
//     name: ''
//   }

//   if (data.passengerId) {
//     passengerId = data.passengerId
//     passenger = await User.findById(data.passengerId)
//   } else {
//     passenger = await User.findOne({ phoneNumber: data.phone })
//     if (passenger) {
//       passengerId = passenger._id
//     } else {
//       const newPassenger = await User.create({ phoneNumber: data.phone, firstName: data.name ? data.name : '_', lastName: '_' })
//       if (newPassenger) {
//         passenger = newPassenger
//         passengerId = newPassenger._id
//       }
//     }
//   }

//   if (data.pickUpAddress.name && data.pickUpAddress.coordinate) {
//     pua.name = data.pickUpAddress.name
//     pua.lat = data.pickUpAddress.coordinate.lat
//     pua.long = data.pickUpAddress.coordinate.long
//     sendRequest()
//   } else if (data.pickUpAddress && data.pickUpAddress.place_id && data.pickUpAddress.name) {
//     Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.pickUpAddress.place_id + '&key=' + setting.mapKey).then((res) => {
//       if (res.status == 200 && res.data.status == 'OK') {
//         pua.name = data.pickUpAddress.name
//         pua.lat = res.data.results[0].geometry.location.lat
//         pua.long = res.data.results[0].geometry.location.lng
//       } else {
//         pickUpAddress.name = '_'
//       }
//       sendRequest()
//     }).catch(err => console.log(err))
//   }

//   async function sendRequest() {
//     let vehicle
//     let vehicles = []
//     const removedDrivers = []

//     if (data.singleDriver) {
//       vehicle = { _id: data.vehicle, driver: data.driver }
//     } else {
//       vehicles = JSON.parse(await getNearbyDrivers({ location: pua, distance: setting.rentSearchRadius ? setting.rentSearchRadius * 1000 : 10000 }))

//       vehicles.forEach((v) => {
//         if (!requestedDrivers.includes(v._id) && vehicle == null && v.driver && ((vehicleTypeData && vehicleTypeData.name && vehicleTypeData.name.toLowerCase() == 'any') ? true : v.vehicleType == data.vehicleType)) {
//           vehicle = v
//           requestedDrivers.push(v._id)
//         }
//       })
//     }

//     if (vehicle) {
//       const rentObject = new RentObject({
//         passengerId,
//         passenger,
//         driverId: vehicle.driver && vehicle.driver._id ? vehicle.driver._id : vehicle.driver,
//         driver: vehicle.driver,
//         dispatcherId: data.dispatcherId,
//         startTimestamp: data.startTimestamp,
//         note: data.note ? data.note : '',
//         endTimestamp: data.endTimestamp,
//         pickUpAddress: {
//           name: pua.name,
//           coordinate: {
//             lat: pua.lat,
//             long: pua.long
//           }
//         },
//         vehicleId: vehicle._id,
//         vehicleType: vehicleTypeData,
//         status: 'inRequest',
//         createdBy: 'dispatcher',
//         timestamp: new Date().getTime(),
//         updateCallback
//       })

//       addRent({ newRent: rentObject })
//       socket.emit('searching')

//       const requests = getAllRequests('dispatcher')
//       const rents = getAllRents('dispatcher')

//       const rentAndRequests = [...requests, ...rents]

//       const dispatchers = getAllDispatchers()

//       dispatchers.forEach((dispatcher) => {
//         io.of('/dispatcher-socket').to(dispatcher.socketId).emit('requests', rentAndRequests)
//       })

//       socket.emit('rentRequest', rentObject)

//       const driver = getDriver({ id: rentObject.driverId })
//       if (driver) {
//         io.of('/driver-socket').to(driver.socketId).emit('rentRequest', rentObject)
//         sendNotification(driver.fcm, { title: 'Rent request', body: 'You have new rent request' })
//         Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: false }, (err, res) => { })

//         setTimeout(() => {
//           if (!driverFound && !canceled) {
//             updateRent({ passengerId: rentObject.passengerId, driverId: rentObject.driverId, status: 'Expired' })

//             if (!data.singleDriver && !removedDrivers.includes(rentObject.driverId)) {
//               removedDrivers.push(rentObject.driverId)
//               sendRequest()
//             }
//           }
//         }, setting && setting.requestTimeout ? setting.requestTimeout * 1000 : 10000)
//       } else {
//         if (!driverFound && !canceled) {
//           updateRent({ passengerId: rentObject.passengerId, driverId: rentObject.driverId, status: 'Expired' })

//           if (!data.singleDriver) {
//             sendRequest()
//           }
//         }
//       }
//     } else {
//       canceled = true
//       socket.emit('noAvailableDriver')
//     }
//   }

//   function updateCallback(rentObject) {
//     if (!driverFound && !canceled) {
//       const requests = getAllRequests('dispatcher')
//       const rents = getAllRents('dispatcher')

//       const rentAndRequests = [...requests, ...rents]

//       const dispatchers = getAllDispatchers()

//       dispatchers.forEach((dispatcher) => {
//         io.of('/dispatcher-socket').to(dispatcher.socketId).emit('requests', rentAndRequests)
//       })

//       const status = rentObject.getStatus()

//       if (status == 'Declined') {
//         var driver = getDriver({ id: rentObject.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestCanceled')

//         if (!data.singleDriver && !removedDrivers.includes(request.driverId)) {
//           removedDrivers.push(request.driverId)
//           sendRequest()
//         }
//         Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
//       } else if (status == 'Expired') {
//         var driver = getDriver({ id: rentObject.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestExpired')
//         Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
//       } else if (status == 'Canceled') {
//         canceled = true
//         var driver = getDriver({ id: rentObject.driverId })
//         if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestCanceled')

//         const passengers = getUsers({ userId: rentObject.passengerId })
//         passengers.forEach((passenger) => {
//           if (passenger) io.of('/passenger-socket').to(passenger.socketId).emit('requestCanceled')
//         })
//         Vehicle.updateOne({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
//       } else if (status == 'Accepted' && (!driverFound && !canceled)) {
//         driverFound = true
//         try {
//           Rent.create({
//             passenger: rentObject.passengerId,
//             driver: rentObject.driverId,
//             pickUpAddress: rentObject.pickUpAddress,
//             note: rentObject.note,
//             vehicleType: rentObject.vehicleType._id,
//             vehicle: rentObject.vehicleId,
//             dispatcher: rentObject.dispatcherId,
//             active: true,
//             status: 'Accepted',
//             createdBy: 'dispatcher'
//           }, (error, rent) => {
//             if (error) console.log({ error })
//             if (rent) {
//               Rent.findById(rent._id, async (error, createdRent) => {
//                 if (error) console.log({ error })
//                 if (createdRent) {
//                   const passengers = getUsers({ userId: rentObject.passengerId })
//                   passengers.forEach((passenger) => {
//                     if (passenger) io.of('/passenger-socket').to(passenger.socketId).emit('rent', createdRent)
//                     sendNotification(passenger.fcm, { title: 'Rent accepted', body: 'Driver is on the way' })
//                   })

//                   const driver = getDriver({ id: rentObject.driverId })
//                   if (driver) io.of('/driver-socket').to(driver.socketId).emit('rent', createdRent)

//                   Vehicle.updateMany({ _id: rentObject.vehicleId }, { online: true }, (err, res) => { })
//                 }
//               }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
//             }
//           })
//         } catch (error) {
//           console.log({ error })
//         }
//       }
//     } else {
//       var driver = getDriver({ id: request.driverId })
//       if (driver) io.of('/driver-socket').to(driver.socketId).emit('requestExpired')
//       Vehicle.updateOne({ _id: request.vehicleId }, { online: true }, (err, res) => { })
//     }
  // }
// }

module.exports = {
  getNearbyDrivers,
  // searchForDispatcher, 
  // rentForDispatcher, 
  getNearbyPools 
}