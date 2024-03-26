const Incentive = require('../models/Incentive')
const Loan = require('../models/Loan')
const Passenger = require('../models/User')
const Token = require('../models/Token')
const Setting = require('../models/Setting')
const logger = require('../services/logger')
const { getVoucher } = require('../services/voucherService')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')
const Voucher = require('../models/Voucher')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {}

    if (req.query.passenger != null && req.query.passenger != 'all') {
      filter.passenger = req.query.passenger
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const incentives = Incentive.find(filter)
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

    incentives.sort({ createdAt: 'desc' })
    incentives.limit(limit)
    incentives.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        if (e && e.toLowerCase() != 'voucher') { incentives.populate(e) }
      })
    }
    Promise.all([
      Incentive.countDocuments(filter),
      incentives.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Incentive => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Incentive => ' + error.toString())
    res.status(500).send(error)
  };
}

const exportReport = async (req, res) => {
  try {
    const filter = {}

    if (req.query.passenger != null && req.query.passenger != 'all') {
      filter.passenger = req.query.passenger
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const incentives = Incentive.find(filter)

    incentives.sort({ createdAt: 'desc' });

    ['passenger'].forEach(model => incentives.populate(model))

    incentives.exec().then((value) => {
      const reportData = [
        [
          'Passenger',
          'Reason',
          'Trip Fare',
          'Trip Count (Then)',
          'Amount',
          'Wallet Balance (Then)',
          'Last Transaction Date',
          'Status',
          'Trip ID'
        ].join('\t'),
        ...value.map(({
          passenger,
          reason,
          tripCount,
          fare,
          amount,
          currentAmount,
          updatedAt,          
          status,
          ride,
        }) => [
          passenger ? [passenger.firstName, passenger.lastName].join(' ') : '-',
          reason,
          tripCount,
          fare,
          amount,
          currentAmount,
          updatedAt,          
          status,
          ride,
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report.xls',
        fileData: reportData
      })
    })
  } catch (error) {
    logger.error('Incentive => ' + error.toString())
    res.status(500).send(error)
  };
}

const cashoutIncentive = async (req, res) => {
  const setting = await Setting.findOne()

  const VALID_AMOUNTS = setting.voucherSettings.voucherTypes.map(({ amount }) => amount)

  try {
    const authHeader = req.headers.authorization

    if (authHeader) {
      const [scheme, tokenSection] = authHeader.split(' ')

      if (scheme === 'Bearer' && tokenSection) {
        const accessToken = tokenSection

        const token = await Token.findById(accessToken).populate('passenger')
        if (token && token.active && token.passenger) {
          if (req.body.amount && !isNaN(req.body.amount)) {
            const amount = Number(req.body.amount)
            if (VALID_AMOUNTS.includes(amount)) {
              const passenger = token.passenger

              if (passenger.balance > amount) {
                try {
                  const voucher = await getVoucher(amount)

                  if (voucher && voucher.voucher) {
                    const incentiveVoucher = await Voucher.create({
                      passenger: passenger._id,
                      ...voucher
                    })

                    await Incentive.create({
                      passenger: passenger._id,
                      amount: -1 * amount,
                      voucher: incentiveVoucher._id,
                      status: 'collected',
                      reason: `Voucher Cashout: ${amount} Birr`
                    })
                    await Passenger.updateOne({
                      _id: passenger._id
                    }, {
                      $inc: {
                        balance: -1 * amount
                      }
                    })

                    return res.status(200).send({
                      voucher,
                      newBalance: passenger.balance - amount
                    })
                  } else {
                    res.status(500).send('voucher system error')
                  }
                } catch (error) {
                  if (error && error.message) { res.status(500).send(error.message) } else { res.status(500).send('internal error') }
                }
              } else {
                res.status(409).send('insufficient balance')
              }
            } else {
              return res.status(422).send(`amount must be one of ( ${VALID_AMOUNTS.join(', ')} )`)
            }
          } else {
            return res.status(422).send('you must send a valid amount')
          }
        } else {
          return res.status(401).send('Unauthorized')
        }
      } else {
        return res.status(401).send('Unauthorized')
      }
    } else {
      return res.status(401).send('Unauthorized')
    }
  } catch (err) {
    logger.error('cashout incentive => ' + err.toString())
    res.status(500).send('internal error')
  }
}

const myVouchers = async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader) {
      const [scheme, tokenSection] = authHeader.split(' ')

      if (scheme === 'Bearer' && tokenSection) {
        const accessToken = tokenSection

        const token = await Token.findById(accessToken).populate('passenger')
        if (token && token.active && token.passenger) {
          const passenger = token.passenger

          const prevVouchers = await Voucher.find({
            passenger: passenger._id
          }).limit(req.query.limit ? Number(req.query.limit) : 20)

          res.status(200).send(prevVouchers)
        } else {
          return res.status(401).send('Unauthorized')
        }
      } else {
        return res.status(401).send('Unauthorized')
      }
    } else {
      return res.status(401).send('Unauthorized')
    }
  } catch (err) {
    logger.error('cashout incentive => ' + err.toString())
    res.status(500).send('internal error')
  }
}

const availableVouchers = async (req, res) => {
  try {
    const setting = await Setting.findOne()

    const availableVouchers = setting.voucherSettings.voucherTypes.map(({ amount }) => amount)
    res.send(availableVouchers)
  } catch (err) {
    logger.error('available vouchers => ' + err.toString())
    res.status(500).send('internal error')
  }
}

module.exports = { index, exportReport, cashoutIncentive, availableVouchers, myVouchers }
