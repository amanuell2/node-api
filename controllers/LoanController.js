const Loan = require('../models/Loan')
const logger = require('../services/logger')

const { filterByTimeRange } = require('../utils/date-filter')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {}

    if (req.query.from != null && req.query.from != 'all') {
      filter.from = req.query.from
    }

    if (req.query.to != null && req.query.to != 'all') {
      filter.to = req.query.to
    }

    if (req.query.paid != null && req.query.paid != 'all') {
      filter.paid = req.query.paid
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const loanHistories = Loan.find(filter)
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

    loanHistories.sort({ createdAt: 'desc' })
    loanHistories.limit(limit)
    loanHistories.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        loanHistories.populate(e)
      })
    }
    Promise.all([
      Loan.countDocuments(filter),
      loanHistories.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Loan history => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Loan history => ' + error.toString())
    res.status(500).send(error)
  };
}

module.exports = { index }
