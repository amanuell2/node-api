const Driver = require('../../models/Driver')
const Account = require('../../models/Account')
const Token = require('../../models/Token')
const { sendNotification } = require('../../services/notificationService')
const { ObjectId } = require('mongoose').Types
const { getIO } = require('../io')

const io = getIO()

// // refactored driver container code
// const emitToDriver = (dispatcherId) => async (event, data) => {
//   const driver = await Driver.findById(dispatcherId)
//   io.of('/driver-socket').to(driver.socketId).emit(event, data)
// }

// const notifyDriver = (dispatcherId) => async (data) => {
//   const driver = await Driver.findById(dispatcherId)
//   // sendNotification(driver.fcm, data)  // TODO: uncomment this later
// }

const updateDispatcher = (dispatcherId) => async (changes) => {
    try {
        await Account.updateOne({ _id: ObjectId(dispatcherId) }, changes)
    } catch (error) {
        console.log(error)
    }
}

const emitToDispatcher = (dispatcherId) => async (event, data) => {
    try {
        const dispatcher = await Account.findById(dispatcherId)
        if (dispatcher)
            io.of('/dispatcher-socket').to(dispatcher.socketId).emit(event, data)
    } catch (error) {
        console.log(error)
    }
  }
  

async function extractDispatcherFromToken(socket) {
    // console.log(">>>TOKEN<<<", socket.handshake)

    if (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) {
        const { token } = socket.handshake.auth

        // console.log(">>>TOKEN<<<")
        // console.log(token)
        try {
            const persistedToken = await Token.findOne({ _id: ObjectId(token), active: true }).populate('account')
            if (persistedToken)
                return persistedToken.account
            else
                throw new Error("unauthorized")
        } catch (e) {
            console.log(e)
            throw e
        }
    }
}

module.exports = {
    //   emitToDriver,
    //   notifyDriver,
    emitToDispatcher,
    updateDispatcher,
    extractDispatcherFromToken
}
