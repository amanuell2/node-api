const Request = require('../../models/Request')

const requests = []

// TODO: refactor these to be store in redis
const addRequest = async ({ newRequest }) => {

  await Request.updateMany({
    driver: newRequest.driverId,
    passenger: newRequest.passengerId
  }, {
    status: "ACTIVE"
  })
  await Request.create(newRequest)
  // const existing = requests.find((request) => request.driverId == newRequest.driverId && request.passengerId == newRequest.passengerId)
  // if (existing) {
  //   removeRequest({ passengerId: newRequest.passengerId, driverId: newRequest.driverId })
  // }
  // requests.push(newRequest)
}

const removeRequest = async ({ passengerId, driverId }) => {

  await Request.updateMany({
    passenger: passengerId,
    driver: driverId,
  }, { status: "REMOVED" })

  // const index = requests.findIndex((request) => driverId ? request.driverId == driverId && request.passengerId == passengerId : request.passengerId == passengerId)

  // if (index != -1) {
  //   requests.splice(index, 1)
  // }
}

const updateRequest = async ({ passengerId, driverId, status }) => {
  await Request.updateOne({
    passenger: passengerId,
    driver: driverId,
  }, {
    status
  })

  // const request = getRequest({ passengerId, driverId })

  // if (request) {
  //   request.updateStatus(status)
  //   removeRequest({ passengerId, driverId })
  // }
}

const getRequest = async ({ passengerId, driverId }) => {
  return await Request.findOne({ // TODO: make sure this is the right function
    passenger: passengerId,
    driver: driverId
  })
  // requests.find((request) => driverId ? request.driverId == driverId && request.passengerId == passengerId : request.passengerId == passengerId)
}

const getDriverRequest = async ({ driverId }) => {
  return await Request.findOne({ driver: driverId })
  // requests.find((request) => request.driverId == driverId)
}

const getPassengerRequest = async ({ passengerId }) => {
  return await Request.findOne({ passenger: passengerId })
  // requests.find((request) => request.passengerId == passengerId)
}

const getAllRequests = async (createdBy) => {
  return createdBy ? await Request.findMany({ createdBy }) : await Request.findMany({})
  // createdBy ? requests.filter((request) => request.createdBy == createdBy) : requests
}

module.exports = { addRequest, removeRequest, getRequest, updateRequest, getDriverRequest, getAllRequests, getPassengerRequest }
