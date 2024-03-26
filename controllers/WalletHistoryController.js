const WalletHistory = require('../models/WalletHistory')
const Loan = require('../models/Loan')
const Driver = require('../models/Driver')
const logger = require('../services/logger')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {}

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    if (req.query.account != null && req.query.account != 'all') {
      filter.account = req.query.account
    }

    if (req.query.by != null && req.query.by != 'all') {
      filter.by = req.query.by
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const walletHistories = WalletHistory.find(filter)
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

    walletHistories.sort({ createdAt: 'desc' })
    walletHistories.limit(limit)
    walletHistories.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        walletHistories.populate(e)
      })
    }
    Promise.all([
      WalletHistory.countDocuments(filter),
      walletHistories.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Wallet history => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Wallet history => ' + error.toString())
    res.status(500).send(error)
  };
}

const exportReport = async (req, res) => {
  try {
    const filter = {}

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    if (req.query.account != null && req.query.account != 'all') {
      filter.account = req.query.account
    }

    if (req.query.by != null && req.query.by != 'all') {
      filter.by = req.query.by
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const walletHistories = WalletHistory.find(filter)

    walletHistories.sort({ createdAt: 'desc' })

    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        walletHistories.populate(e)
      })
    }

    ['driver', 'account', 'from', 'ride'].forEach(model => walletHistories.populate(model))

    walletHistories.exec().then((value) => {
      const reportData = [
        [
          'Driver',
          'Amount',
          'Payment Type',
          'By',
          'User',
          'Reason',
          'Last Transaction Date',
          'Status'
        ].join('\t'),
        ...value.map(({
          driver,
          amount,
          reason,
          paymentType,
          by,
          account,
          from,
          updatedAt,
          status
        }) => [
          driver ? [driver.firstName, driver.lastName].join(' ') : '-',
          amount,
          paymentType,
          by,
          account
            ? account.firstName + ' ' + account.lastName
            : from
              ? from.firstName + ' ' + from.lastName
              : '-',
          reason,
          updatedAt,
          status
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report.xls',
        fileData: reportData
      })

      // res.send({ data: value[1], count: value[0], nextPage, prevPage });
    }).catch((error) => {
      logger.error('Wallet history => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Wallet history => ' + error.toString())
    res.status(500).send(error)
  };
}

const bankDepositDetail = (req, res) => {
  if (req.params.id) {
    WalletHistory.findById(req.params.id).then(walletRecord => {
      res.status(200).send(walletRecord)
    }).catch(err => {
      res.status(500).send(err)
    })
  } else {
    res.status(422).send(new Error('you must send Transaction ID'))
  }
}

const markDepositAsPaid = (req, res) => {
  if (req.params.id) {
    WalletHistory.findById(req.params.id).then(walletRecord => {
      if (walletRecord.paymentType !== 'bank_deposit') {
        return res.status(409).send(new Error("can't mark non-bank top-up as paid"))
      } else {
        Driver.findById(walletRecord.driver, async (error, driver) => {
          if (error) {
            logger.error('Top up => ' + error.toString())
            res.status(500).send(error)
          } else if (driver) {
            if (walletRecord.amount < 0) {
              res.send({ ballance: driver.ballance })
            } else {
              const topUpAmount = walletRecord.amount

              const ballance = driver.ballance + topUpAmount
              Driver.updateOne({ _id: walletRecord.driver }, { ballance }, (error, updateResponse) => {
                if (error) {
                  logger.error('Top up => ' + error.toString())
                  res.status(500).send(error)
                } else if (updateResponse) {
                  WalletHistory.updateOne({
                    _id: walletRecord._id
                  }, {
                    $set: {
                      status: 'paid',
                      'deposit.status': 'paid',
                      currentAmount: ballance
                    }
                  }, (error, transaction) => {
                    if (error) {
                      logger.error('Error marking a transaction as paid => ' + error.toString())
                      res.status(500).send(error)
                    } else if (transaction) {
                      Loan.find({ to: walletRecord.driver, paid: false }, async (error, loans) => {
                        if (error) {
                          logger.error('Top up => ' + error.toString())
                          res.status(500).send(error)
                        } else if (loans) {
                          // var topUpAmount = req.body.amount;
                          for (const unpaidLoan of loans) {
                            const { ballance } = await Driver.findById(walletRecord.driver)

                            if (ballance > unpaidLoan.amount) {
                              const newBalance = ballance - unpaidLoan.amount
                              try {
                                await Driver.updateOne({ _id: unpaidLoan.to }, { ballance: newBalance })
                                logger.info(`Driver => top up, amount = ${topUpAmount} , balance = ${newBalance}`)
                              } catch (error) {
                                logger.error('Top up => ' + error.toString())
                              }

                              const secondDriver = await Driver.findById(unpaidLoan.from)
                              if (secondDriver) {
                                secondDriver.ballance = secondDriver.ballance + unpaidLoan.amount
                                await secondDriver.save()
                                await WalletHistory.create({
                                  driver: unpaidLoan.from,
                                  reason: 'Wallet loan pay back',
                                  by: 'System',
                                  amount: unpaidLoan.amount,
                                  from: unpaidLoan.to,
                                  deposit: walletRecord.deposit
                                })
                                await WalletHistory.create({
                                  driver: unpaidLoan.to,
                                  reason: 'Wallet loan pay back',
                                  by: 'System',
                                  amount: -1 * unpaidLoan.amount,
                                  from: unpaidLoan.from,
                                  deposit: walletRecord.deposit
                                })
                              }

                              unpaidLoan.paid = true
                              await unpaidLoan.save()
                            }
                          }

                          res.send({ ballance: (await Driver.findById(walletRecord.driver)).ballance })
                        }
                      })
                    }
                  })
                }
              })
            }

            // Loan.find({ to: walletRecord.driver, paid: false }, (error, loans) => {
            //     if (error) {
            //         logger.error("Top up => " + error.toString());
            //         res.status(500).send(error);
            //     }
            //     if (loans) {
            //         var topUpAmount = walletRecord.amount;
            //         loans.forEach(async (loan) => {
            //             if (topUpAmount >= loan.amount) {
            //                 topUpAmount -= loan.amount - loan.paidAmount;
            //                 loan.paidAmount = loan.amount;
            //                 loan.paid = true;
            //                 var secondDriver = await Driver.findById(loan.from);
            //                 if (secondDriver) {
            //                     secondDriver.ballance = secondDriver.ballance + loan.paidAmount;
            //                     await secondDriver.save();
            //                     await WalletHistory.create({
            //                         driver: loan.from,
            //                         reason: "Wallet loan pay back",
            //                         by: "System",
            //                         amount: loan.paidAmount,
            //                         from: loan.to,
            //                         deposit: walletRecord.deposit,
            //                     });
            //                     await WalletHistory.create({
            //                         driver: loan.to,
            //                         reason: "Wallet loan pay back",
            //                         by: "System",
            //                         amount: -1 * loan.paidAmount,
            //                         from: loan.from,
            //                         deposit: walletRecord.deposit,
            //                     });
            //                 }
            //             } else if (topUpAmount > 0) {
            //                 topUpAmount = 0;
            //                 loan.paidAmount = topUpAmount;
            //                 loan.paid = false;
            //                 var secondDriver = await Driver.findById(loan.from);
            //                 if (secondDriver) {
            //                     secondDriver.ballance = secondDriver.ballance + loan.paidAmount;
            //                     await secondDriver.save();
            //                     await WalletHistory.create({
            //                         driver: loan.from,
            //                         reason: "Wallet loan pay back",
            //                         by: "System",
            //                         amount: loan.paidAmount,
            //                         from: loan.to,
            //                         deposit: walletRecord.deposit,
            //                     });
            //                     await WalletHistory.create({
            //                         driver: loan.to,
            //                         reason: "Wallet loan pay back",
            //                         by: "System",
            //                         amount: -1 * loan.paidAmount,
            //                         from: loan.from,
            //                         deposit: walletRecord.deposit,
            //                     });
            //                 }
            //             }
            //             await loan.save();
            //         });

            //         if (topUpAmount > 0) {
            //             var ballance = driver.ballance + topUpAmount;
            //             Driver.updateOne({ _id: walletRecord.driver }, { ballance }, (error, updateResponse) => {
            //                 if (error) {
            //                     logger.error("Top up => " + error.toString());
            //                     res.status(500).send(error);
            //                 }
            //                 if (updateResponse) {
            //                     WalletHistory.updateOne({
            //                         _id: req.params.id
            //                     }, {
            //                         $set: {
            //                             "status": "paid",
            //                             'deposit.status': "paid",
            //                             "currentAmount": ballance
            //                         }
            //                     }).then(() => {
            //                         res.status(200).send({ success: true })
            //                     }).catch(err => {
            //                         res.status(500).send(err)
            //                     })
            //                     // WalletHistory.create({ driver: walletRecord.driver, amount: topUpAmount, reason: walletRecord.reason, by: 'admin', account: walletRecord.account, paymentType: walletRecord.paymentType, deposit: walletRecord.deposit }, (error, wallet) => {
            //                     //     if (error) {
            //                     //         logger.error("Top up => " + error.toString());
            //                     //         res.status(500).send(error);
            //                     //     }
            //                     //     if (wallet) {
            //                     //         logger.info(`Driver => top up, amount = ${topUpAmount} , balance = ${ballance}`);
            //                     //         res.send({ ballance });
            //                     //     }
            //                     // })
            //                 }
            //             })
            //         } else {
            //             res.send({ ballance: driver.ballance });
            //         }
            //     }
            // });
          }
        })
      }
    }).catch(err => {
      res.status(500).send(err)
    })
  } else {
    res.status(422).send(new Error('you must send Transaction ID'))
  }
}
module.exports = { index, bankDepositDetail, markDepositAsPaid, exportReport }
