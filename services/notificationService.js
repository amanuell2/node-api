const { default: axios } = require('axios')
const logger = require('./logger')
require('dotenv/config')

const sendNotification = (to, message, returnStatus, adminSent) => {
  // TODO:: Implement Push notification
  const data = {
    notification: {
      title: message && message.title ? message.title : 'title',
      body: message && message.body ? message.body : 'body',
      sound: 'sound'
    },
    priority: 'high',
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      id: '1',
      status: 'done',
      type: adminSent ? "news": ""
    },
    to: to
  }

  const config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.FCM_TOKEN
    }
  }

  logger.info('Notification => to: ' + to + ', message: ' + message)

  if (returnStatus) {
    return axios.post('https://fcm.googleapis.com/fcm/send', data, config)
  } else {
    axios.post('https://fcm.googleapis.com/fcm/send', data, config).catch(err => console.error(err))
  }
}

module.exports = { sendNotification }
