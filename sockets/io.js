// const { isValidObjectId } = require('mongoose')

let io

const getIO = () => io

const setIO = (IO) => io = IO

module.exports = { getIO, setIO }
