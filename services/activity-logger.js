const ActivityLog = require('../models/ActivityLog')
const ACTIVITY_LOGS = require('../constants/activitylogs')

// driver connections
exports.DRIVER_HAS_CONNECTED = async (data) => {
    return `Driver - ${data.vehicle.plateNumber} has connected`
}

exports.DRIVER_HAS_BECOME_ONLINE = async (data) => {
    return `Driver - ${data.vehicle.plateNumber} has become online`
}

exports.DRIVER_HAS_BECOME_OFFLINE = async (data) => {
    return `Driver - ${data.vehicle.plateNumber} has become offline`
}

exports.DRIVER_HAS_DISCONNECTED = async (data) => {
    return `Driver - ${data.vehicle.plateNumber} has disconnected`
}


// driver mock report

exports.DRIVER_MOCK_REPORTED = async (data) => {
    return `Driver - ${data.vehicle.plateNumber} (${data.driver.phoneNumber}) has been reported for location mocking`
}


// passenger connections

exports.PASSENGER_HAS_BECOME_ONLINE = async (data) => {
    return `Passenger - ${data.passenger.phoneNumber} has become online`
}

exports.PASSENGER_HAS_BECOME_ONLINE = async (data) => {
    return `Passenger - ${data.passenger.phoneNumber} has become offline`
}

exports.PASSENGER_HAS_CONNECTED = async (data) => {
    return `Passenger - ${data.passenger.phoneNumber} has connected`
}

exports.PASSENGER_HAS_DISCONNECTED = async (data) => {
    return `Passenger - ${data.passenger.phoneNumber} has disconnected`
}

// pools

exports.POOL_HAS_BEEN_CANCELLED = async (data) => {
    return `Pool created by "${data.driver.firstName} ${data.driver.lastName}" has been cancelled`
}

exports.POOL_HAS_BEEN_CREATED = async (data) => {
    return `New Pool has been created by "${data.driver.firstName} ${data.driver.lastName}"`
}

exports.POOL_HAS_ENDED = async (data) => {
    return `Pool created by "${data.driver.firstName} ${data.driver.lastName}" has ended`
}

exports.POOL_HAS_STARTED = async (data) => {
    return `Pool created by "${data.driver.firstName} ${data.driver.lastName}" has started`
}

exports.POOL_TRIP_HAS_COMPLETED = async (data) => {
    return `${data.trip.passenger.firstName}'s pool-trip has been completed.`
}

// admin activities

exports.ADMIN_HAS_LOGGED_IN = async ({ account: { firstName, lastName, email, _id } }) => {
    await ActivityLog.create({
        subject: _id,
        subjectModel: 'accounts',

        action: `${firstName} ${lastName} (${email}) has logged in`,
        actionCode: ACTIVITY_LOGS.ADMIN_LOGIN,
    })
}

exports.ADMIN_HAS_EXPORTED_REPORTED = async ({
    account: { firstName, lastName, email, _id },
    url,
    path
}) => {
    await ActivityLog.create({
        subject: _id,
        subjectModel: 'accounts',

        action: `${firstName} ${lastName} (${email}) has exported report (${path})`,
        actionCode: ACTIVITY_LOGS.EXPORT_REPORT,

        url: url,
        
    })
}

exports.ADMIN_HAS_CREATED_RESOURCE = async ({
    account: { firstName, lastName, email, _id },
    url,
    path
}) => {
    await ActivityLog.create({
        subject: _id,
        subjectModel: 'accounts',

        action: `${firstName} ${lastName} (${email}) has created a new "${path}" resource`,
        actionCode: ACTIVITY_LOGS.CREATE_RESOURCE,

        url
        
    })
}

exports.ADMIN_HAS_UDPDATED_RESOURCE = async ({
    account: { firstName, lastName, email, _id },
    url,
    path
}) => {
    await ActivityLog.create({
        subject: _id,
        subjectModel: 'accounts',

        action: `${firstName} ${lastName} (${email}) has updated ${path} resource`,
        actionCode: ACTIVITY_LOGS.UPDATE_RESOURCE,

        url
        
    })
}

// exports.logActivity = (logSerializer) => async (data) => await logSerializer(data)