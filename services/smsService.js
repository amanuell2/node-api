const { default: axios } = require('axios')
const logger = require('./logger')
require('dotenv/config')
const Setting = require('../models/Setting')

const sendSMS = async (to, message) => {
  const { smsSettings } = await Setting.findOne()

  const API_ENDPOINT = smsSettings.endpoint

  const data = {
    username: smsSettings.username,
    password: smsSettings.password,
    to: to,
    from: '8610',
    text: message,
    'dlr-mask': smsSettings.dlrMask,
    'dlr-url': smsSettings.dlrURL
  }

  const config = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  logger.info('SMS => to: ' + to + ', message: ' + message)

  return axios.get(API_ENDPOINT, {
    params: data
  }, config)
}

module.exports = { sendSMS }
