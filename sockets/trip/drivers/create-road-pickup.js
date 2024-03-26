const Ride = require("../../../models/Ride")
const Setting = require("../../../models/Setting")
const VehicleType = require("../../../models/VehicleType")
const User = require("../../../models/User")
const { emitToPassenger } = require("../../utils/passenger")
const { emitToDriver } = require("../../utils/driver")
const { makeRequest } = require('../../../services/axios')
const { sanitizeInputs } = require('../../utils/core')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_TYPES = require('../../../constants/trip-types')
const { updateVehicle } = require("../../utils/vehicle")

const schema = {
    type: 'object',
    properties: {
        pickUpAddress: { type: 'object' },
        dropOffAddress: { type: 'object' },
        vehicleType: { type: 'string' },
        passengerPhone: { type: 'string' },
    },
    required: ["pickUpAddress", "dropOffAddress", "passengerPhone"],
    additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {

    try {
        await sanitizeInputs(schema, data)

        const prevTrip = await Ride.findOne({ status: TRIP_STATUS.STARTED, driver: driver._id }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

        if (prevTrip) {
            socket.emit('trip', prevTrip)
        } else {
            const setting = await Setting.findOne()
            let passengerId = ''
            const vehicleTypeData = await VehicleType.findById(data.vehicleType)
            let pickup = data.pickUpAddress.name
            let dropOff = data.dropOffAddress.name

            const passenger = await User.findOne({ phoneNumber: data.passengerPhone })
            if (passenger) {
                passengerId = passenger._id
            } else {
                try {
                    const newPassenger = await User.createWithInviteCode({ phoneNumber: data.passengerPhone, firstName: data.name ? data.name : '_', lastName: '_' })
                    if (newPassenger) {
                        passengerId = newPassenger._id
                    }
                } catch(err) {
                    return socket.emit('error', {
                        message: 'error creating the user'
                    })
                }
            }

            if (!pickup) {
                pickup = makeRequest({ method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.pickUpAddress.lat + ',' + data.pickUpAddress.long + '&key=' + setting.mapKey })
            }

            if (!dropOff) {
                dropOff = makeRequest({ method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.dropOffAddress.lat + ',' + data.dropOffAddress.long + '&key=' + setting.mapKey })
            }

            // const route = makeRequest({ method: 'get', url: 'https://api.mapbox.com/directions/v5/mapbox/driving/' + data.pickUpAddress.long + ',' + data.pickUpAddress.lat + ';' + data.dropOffAddress.long + ',' + data.dropOffAddress.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw' })
            
            
            Promise.all([pickup, dropOff]).then(async ([pickupRes, dropOffRes]) => {

                if (typeof (pickupRes) !== typeof (' ')) {
                    if (pickupRes.status == 200 && pickupRes.data.status == 'OK') {
                        data.pickUpAddress.name = pickupRes.data.results[0].formatted_address
                    } else {
                        data.pickUpAddress.name = '_'
                    }
                } else {
                    data.pickUpAddress.name = pickup
                }
                
                if (typeof (dropOffRes) !== typeof (' ')) {
                    if (dropOffRes.status == 200 && dropOffRes.data.status == 'OK') {
                        console.log('status ok pul')
                        data.dropOffAddress.name = dropOffRes.data.results[0].formatted_address
                    } else {
                        data.dropOffAddress.name = '_'
                        console.log('wrong response dol', dropOffRes)
                    }
                } else {
                    data.dropOffAddress.name = dropOffRes
                }
                
                if (data.route && data.route.polyline) {
                    console.log("using route from mobile app")   
                } else {
                    const googleMapsRouteRes = await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${data.pickUpAddress.lat},${data.pickUpAddress.long}&destination=${data.dropOffAddress.lat},${data.dropOffAddress.long}&key=${setting.mapKey}` })
                    if (googleMapsRouteRes) {
                        if (googleMapsRouteRes.data.status == "OK") {
                            const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
                            const distance = googleMapsRouteRes.data.routes[0].legs[0].distance.value;
                            const duration = googleMapsRouteRes.data.routes[0].legs[0].duration.value;
                            data.route = {
                                distance,
                                duration,
                                polyline,
                            }
                        } else {
                            return socket.emit('error', {
                                type: "route",
                                message: "google can not find the route."
                            })
                        }
        
                    }
                }


                try {
                    const prevTrip = await Ride.findOne({ status: TRIP_STATUS.STARTED, driver: driver._id }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

                    console.log('>>>', prevTrip)
                    if (prevTrip) {
                        await emitToDriver(driver._id)('trip', prevTrip)
                    } else {
                        const ride = await Ride.create({
                            passenger: passengerId,
                            driver: driver._id,
                            vehicle: vehicle._id,
                            type: TRIP_TYPES.ROAD_PICKUP,
                            pickUpAddress: {
                                name: data.pickUpAddress.name,
                                lat: data.pickUpAddress.lat,
                                long: data.pickUpAddress.long
                            },
                            dropOffAddress: {
                                name: data.dropOffAddress.name,
                                lat: data.dropOffAddress.lat,
                                long: data.dropOffAddress.long
                            },
                            vehicleType: vehicleTypeData._id,
                            route: data.route,
                            status: TRIP_STATUS.STARTED,
                            active: true,
                            pickupTimestamp: new Date(),
                            createdBy: 'app'
                        })
                        
                        const createdRide = await Ride.findById(ride._id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
                        await emitToDriver(driver._id)('trip', createdRide)
                        // await emitToDriver(driver._id)('tripStatus', { status: createdRide.status })

                        await updateVehicle(vehicle._id)({ online: false,
                            inActiveTrip: true,
                            // tripId: ride._id
                        })
                        await emitToPassenger(passengerId)('trip', createdRide)
                        // await emitToPassenger(passengerId)('tripStatus', { status: createdRide.status })
                        
                    }
                } catch (error) {
                    console.log(error)
                }
            }).catch(err => console.log(err))
        }

    } catch (err) {
console.log(err)
socket.emit(err)
    }
}