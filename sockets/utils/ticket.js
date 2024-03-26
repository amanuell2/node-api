const Ticket = require('../../models/Ticket')
const { ObjectId } = require('mongoose').Types

const updateTicket = (ticketId) => async (changes) => {
  try {
    await Ticket.updateOne({ _id: ObjectId(ticketId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  updateTicket
}
