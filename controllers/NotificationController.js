const Notification = require('../models/Notification')
const Driver = require('../models/Driver')
const Passenger = require('../models/User')
const { sendNotification } = require('../services/notificationService')
const logger = require('../services/logger')
const { sendSMS } = require('../services/smsService')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      $or: [
        {
          title: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          body: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    if (req.query.to != null && req.query.to !== 'all') {
      filter.to = req.query.to
    }

    if (req.query.status != null && req.query.status !== 'all') {
      filter.status = req.query.status
    }

    const notifications = Notification.find(filter)
    if (req.query.page && parseInt(req.query.page) != 0) {
      page = parseInt(req.query.page)
    }
    if (req.query.limit) {
      limit = parseInt(req.query.limit)
    }

    if (page > 1) {
      prevPage = page - 1
    }

    skip = (page - 1) * limit

    notifications.sort({ createdAt: 'desc' })
    notifications.limit(limit)
    notifications.skip(skip)
    Promise.all([
      Notification.countDocuments(filter),
      notifications.exec()
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    })
  } catch (error) {
    res.send(error)
  };
}

const search = (req, res) => {
  try {
    const filter = {
      title: {
        $regex: req.query.q ? req.query.q : '', $options: 'i'
      }
    }

    if (req.query.to != null) {
      filter.to = req.query.to
    }

    Notification.find(filter, (error, notifications) => {
      if (error) {
        logger.error('Notification => ' + error.toString())
        res.status(500).send(error)
      }

      if (notifications) {
        res.send(notifications)
      }
    }).limit(10)
  } catch (error) {
    logger.error('Notification => ' + error.toString())
    res.status(500).send(error)
  }
}

const sendByToken = (req, res) => {
  try {
    if (req.params.token && req.body && req.body.title && req.body.body) {
      Notification.create({ title: req.body.title, body: req.body.body, to: req.params.token, type: 'token' }, (error, notification) => {
        if (error) {
          logger.error('Notification => ' + error.toString())
          res.status(500).send(error)
        }
        if (notification) {
          sendNotification(req.params.token, req.body)
          res.send('Notification sent')
        }
      })
    } else {
      res.status(500).send('Invalid data')
    }
  } catch (error) {
    logger.error('Notification => ' + error.toString())
    res.status(500).send(error)
  }
}

const sendByTopic = (req, res) => {
  if (req.body.medium && req.params.topic && req.body && req.body.title && req.body.body) {
    const medium = req.body.medium
    const actions = {
      sms: () => Promise.resolve(false),
      push: () => Promise.resolve(false)
    }
    const result = {
      sms: '',
      push: ''
    }
    if (['both', 'push'].includes(medium)) {
      actions.push = () => new Promise((rs, reject) => {
        resolve = (x) => {
          result.push = true
          rs(x)
        }
        try {
          Notification.create({ title: req.body.title, body: req.body.body, to: req.params.topic, type: 'topic' }, (error, notification) => {
            if (error) {
              logger.error('Notification => ' + error.toString())
              // Notification.updateOne({
              //     _id: notification._id
              // }, {
              //     $set: {
              //         status: "failed",
              //     },
              // }).then(() =>
              //     reject(error)
              // );
              reject(error)
            }
            if (notification) {
              sendNotification('/topics/' + req.params.topic, req.body, true, true).then(() => {
                Notification.updateOne({
                  _id: notification._id
                }, {
                  $set: {
                    status: 'success'
                  }
                }).then(() =>
                  resolve('Notification sent')
                )
              }).catch((error) => {
                logger.error('Notification service => ' + error.toString())
                console.log(notification)
                Notification.updateOne({
                  _id: notification._id
                }, {
                  $set: {
                    status: 'failed'
                  }
                }).then(() =>
                  reject(error)
                )
              })
            }
          })
        } catch (error) {
          logger.error('Notification => ' + error.toString())
          reject.send(error)
        }
      }).then((x) => {
        return x
      })
    }

    if (['both', 'sms'].includes(medium)) {
      actions.sms = () => new Promise((rs, reject) => {
        const resolve = (x) => {
          result.sms = true
          rs(x)
        }
        console.log('sending SMS')

        new Promise(async (res, rej) => {
          res([
            ['all', 'passenger'].includes(req.params.topic) ? await Passenger.find({}, { phoneNumber: true, _id: false }) : [],
            ['all', 'driver'].includes(req.params.topic) ? await Driver.find({}, { phoneNumber: true, _id: false }) : []
          ].flat())
        }).then(async smsReceivers => {
          Promise.all(smsReceivers.map(({ phoneNumber }) => sendSMS(phoneNumber, req.body.body))).then(() => {
            resolve(true)
          })
          //    await sendSMS('sdfsd', 'test')
          // console.log(smsReceivers)
        })

        // setTimeout(() => {

        //     resolve('sent')
        // }, 1000)
      })
    }

    Object.values(actions).reduce((p, fn) => p.then(typeof fn === typeof (() => { }) ? fn : Promise.resolve()), Promise.resolve()).then(() => {
      res.send({
        result
      })
    }).catch(err => {
      console.log('error')
      console.log(err)
      res.status(500).send({
        result,
        err
      })
    })
  } else {
    res.status(422).send(new Error('you must specify medium'))
  }
}

module.exports = { sendByToken, sendByTopic, index, search }
