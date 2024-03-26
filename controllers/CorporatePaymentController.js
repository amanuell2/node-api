const CorporatePayment = require('../models/CorporatePayment')
const logger = require('../services/logger')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

    const corporatePayments = CorporatePayment.find()
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

    corporatePayments.sort({ createdAt: 'desc' })
    corporatePayments.limit(limit)
    corporatePayments.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        corporatePayments.populate(e)
      })
    }
    Promise.all([
      CorporatePayment.estimatedDocumentCount(),
      corporatePayments.exec()
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Corporate payment => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Corporate payment => ' + error.toString())
    res.status(500).send(error)
  };
}

module.exports = { index }
