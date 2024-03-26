const express = require('express')
const bodyParser = require('body-parser')
const Driver = require('../models/Driver')
const WalletHistory = require('../models/WalletHistory')
const logger = require('../services/logger')
const { ObjectId } = require('mongoose').Types

var options = {
    ignoreAttributes: false,
    attributeNamePrefix: "--",
};

const fastXmlParser = require('fast-xml-parser');
const Loan = require('../models/Loan')
const parser = new fastXmlParser.XMLParser(options);
const builder = new fastXmlParser.XMLBuilder(options);

const sealInEnvelope = (jsonMessage) => {
    return {
        'soapenv:Envelope': {
            'soapenv:Header': '',
            'soapenv:Body': jsonMessage,
            '--xmlns:soapenv': "http://schemas.xmlsoap.org/soap/envelope/",
            '--xmlns:c2b': "http://cps.huawei.com/cpsinterface/c2bpayment",
        }
    }
}

const generateC2BPaymentQueryResult = (obj) => {
    return builder.build(sealInEnvelope({
        'c2b:C2BPaymentQueryResult': obj,
        // "--xmlns:c2b": "http://cps.huawei.com/cpsinterface/c2bpayment",

    }))
}
const generateC2BPaymentValidationResult = (obj) => {
    return builder.build(sealInEnvelope({
        'c2b:C2BPaymentValidationResult': obj,
        // "--xmlns:c2b": "http://cps.huawei.com/cpsinterface/c2bpayment",

    }))
}
const generateC2BPaymentConfirmationResult = (result) => {
    return builder.build(sealInEnvelope({
        'c2b:C2BPaymentConfirmationResult': result,
        // "--xmlns:c2b": "http://cps.huawei.com/cpsinterface/c2bpayment",
    }))
}

const router = express.Router()

router.use(bodyParser.raw({ type: function () { return true; }, limit: '5mb' }));

router.use((req, res, next) => {
    console.log(req.body)
    var jsonObj = parser.parse(req.body, options);
    if (!jsonObj) return res.status(422).send("invalid envelope")
    if (!jsonObj['soapenv:Envelope']) return res.status(422).send("invalid envelope. missing envelope tag")
    if (!jsonObj['soapenv:Envelope']['soapenv:Body']) return res.status(422).send("invalid envelope. missing envelope body")

    const soapBody = jsonObj['soapenv:Envelope']['soapenv:Body']

    console.log(JSON.stringify(soapBody, null, 2))


    res.locals.soapBody = soapBody

    next()
})

router.post('/payment-request', async (req, res) => {

    console.log('payment query')
    console.log('payment query')
    console.log('payment query')
    console.log('payment query')
    console.log('payment query')
    console.log('payment query')

    console.log(JSON.stringify(res.locals, null, 2))
    try {

        const { soapBody } = res.locals

        if (!soapBody['c2b:C2BPaymentQueryRequest']) {
            return res.status(422).send("not valid C2BPaymentQueryRequest. missing tag.")
        }

        const { TransType, TransID, TransTime, BusinessShortCode, MSISDN, Amount, BillRefNumber } = soapBody['c2b:C2BPaymentQueryRequest']

  
        const amount = Amount && !isNaN(Amount) ? Number(Amount) : 300
  
        if (!(BillRefNumber && String(BillRefNumber).length)) {
            const paymentQueryResult = {
                "ResultCode": "-1",
                "ResultDesc": "Phone number not provided (BillRefNumber)",
                "TransID": TransID,
                "UtilityName": "Ilift",
                "CustomerName": "None",
                "BillRefNumber": BillRefNumber,
                "Amount": `${amount.toFixed(2)}`,
            }

            return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));
        }

        const phoneNumber = String(BillRefNumber)[0] === '+' ? String(BillRefNumber) : `+${BillRefNumber}`

        if (!phoneNumber.startsWith('+251')) {
            const paymentQueryResult = {
                "ResultCode": "-1",
                "ResultDesc": "Invalid phone format (start with 251)",
                "TransID": TransID,
                "UtilityName": "Ilift",
                "CustomerName": "None",
                "BillRefNumber": BillRefNumber,
                "Amount": `${amount.toFixed(2)}`,
            }

            return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));
        }

        const driver = await Driver.findOne({ phoneNumber: phoneNumber })

        if (!driver) {
            const paymentQueryResult = {
                "ResultCode": "-1",
                "ResultDesc": "Driver not found.",
                "TransID": TransID,
                "UtilityName": "Ilift",
                "CustomerName": "None",
                "BillRefNumber": BillRefNumber,
                "Amount": `${amount.toFixed(2)}`,
            }

            return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));
        }

        if (Amount <= 0 || Amount > 100000) {

            const paymentQueryResult = {
                "ResultCode": "-1",
                "ResultDesc": "Invalid amount. must be in range (0 - 100000)",
                "TransID": TransID,
                "UtilityName": "Ilift",
                "CustomerName": driver.firstName + ' ' + driver.lastName,
                "BillRefNumber": BillRefNumber,
                "Amount": `${amount.toFixed(2)}`,
            }

            return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));
        }

        // // if (!(req.body.deposit.by || req.body.deposit.bank || req.body.deposit.transaction || req.body.deposit.narrative || req.body.deposit.date)) {
        // //     return res.status(500).send('Invalid bank deposit data')
        // //   } else {
        // const telebirr = {
        //     TransType,
        //     TransID,
        //     TransTime,
        //     BusinessShortCode,
        //     MSISDN,
        //     status: 'unpaid'
        // };
        // const wallet = await WalletHistory.create({ driver: driver._id, amount: Amount, reason: "Topup via TeleBirr", by: 'telebirr', account: null, paymentType: 'telebirr', deposit: null, telebirr: telebirr, status: 'unpaid' })
        // if (wallet) {
        //     console.log(`Driver Telebirr recorded => top up, amount = ${Amount}`)
        //     // res.send({ success: true })
        const paymentQueryResult = {
            "ResultCode": "0",
            "ResultDesc": "success",
            "TransID": TransID,
            "UtilityName": "Ilift",
            // "BillRefNumber": String(wallet._id),
            "CustomerName": driver.firstName + ' ' + driver.lastName,
            "BillRefNumber": BillRefNumber,
            "Amount": `${amount.toFixed(2)}`,
        }


        return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));

        // }
        //   }
    } catch (err) {
        console.log("telebirr payment query:", err)
        return res.status(500).send(err)
    }
})

router.post('/payment-validation', async (req, res) => {

    console.log('payment validation')
    console.log('payment validation')
    console.log('payment validation')
    console.log('payment validation')
    console.log('payment validation')
    console.log('payment validation')

    console.log(JSON.stringify(res.locals, null, 2))

    try {

        const { soapBody } = res.locals

        if (!soapBody['c2b:C2BPaymentValidationRequest']) {
            return res.status(422).send("not valid C2BPaymentValidationRequest. missing tag.")
        }

        const { TransType, TransID, TransTime, BusinessShortCode, MSISDN, TransAmount, KYCInfo, BillRefNumber } = soapBody['c2b:C2BPaymentValidationRequest']

        if (!(BillRefNumber && String(BillRefNumber).length)) {
            const paymentQueryResult = {
                "ResultCode": "-1",
                "ResultDesc": "Invalid BillRefNumber given",
                "ThirdPartyTransID": "null",
            }

            return res.contentType('text/html').send(generateC2BPaymentQueryResult(paymentQueryResult));
        }

        const phoneNumber = String(BillRefNumber)[0] === '+' ? BillRefNumber : `+${BillRefNumber}`

        const driver = await Driver.findOne({ phoneNumber: phoneNumber })

        const telebirr = {
            TransType,
            TransID,
            TransTime,
            BusinessShortCode,
            MSISDN,
            status: 'paid'
        };

        // const amount = 10
        const amount = TransAmount

        const topUpAmount = amount
        const ballance = driver.ballance + topUpAmount
        const updateResponse = await Driver.updateOne({ _id: driver._id }, { ballance })

        const wallet = await WalletHistory.create({ driver: driver._id, amount: amount, reason: `Topup via TeleBirr. ID: ${TransID}`, by: `telebirr`, account: null, paymentType: 'telebirr', deposit: null, telebirr: telebirr, status: 'paid' })
        if (wallet) {
            console.log(`Driver Telebirr recorded => top up, amount = ${amount}`)
            // res.send({ success: true })

            const loans = await Loan.find({ to: wallet.driver, paid: false })

            for (const unpaidLoan of loans) {
                const { ballance } = await Driver.findById(wallet.driver)

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
                            deposit: wallet.deposit
                        })
                        await WalletHistory.create({
                            driver: unpaidLoan.to,
                            reason: 'Wallet loan pay back',
                            by: 'System',
                            amount: -1 * unpaidLoan.amount,
                            from: unpaidLoan.from,
                            deposit: wallet.deposit
                        })
                    }

                    unpaidLoan.paid = true
                    await unpaidLoan.save()
                }
            }


            const c2BPaymentValidationResult = {
                "ResultCode": "0",
                "ResultDesc": "Success",
                "ThirdPartyTransID": String(wallet._id),
            }

            return res.contentType('text/html').send(generateC2BPaymentValidationResult(c2BPaymentValidationResult));

        }
    } catch (err) {
        console.log("telebirr payment validation:", err)
        return res.status(500).send(err)
    }


})

router.post('/payment-confirmation', async (req, res) => {
    var jsonObj = parser.parse(req.body, options);
    // console.log(jsonObj['soapenv:Envelope']['soapenv:Body']['c2b:C2BPaymentConfirmationRequest'])
    console.log(jsonObj['soapenv:Envelope']['soapenv:Body'])


    try {

        const { soapBody } = res.locals

        if (!soapBody['c2b:C2BPaymentConfirmationRequest']) {
            return res.status(422).send("not valid C2BPaymentConfirmationRequest. missing tag.")
        }

        const { TransType,
            TransID,
            TransTime,
            TransAmount,
            BusinessShortCode,
            BillRefNumber,
            ThirdPartyTransID
        } = soapBody['c2b:C2BPaymentConfirmationRequest']

        let wallet;

        try {
            wallet = await WalletHistory.findOne({ _id: ObjectId(ThirdPartyTransID) })

            if (!wallet) {
                return res.contentType('text/html').send(generateC2BPaymentConfirmationResult(`${ThirdPartyTransID} DOES NOT EXIST`));
            }

            // await WalletHistory.updateOne({ _id: ObjectId(ThirdPartyTransID) }, { $set: { 'telebirr.status': 'PAID', status: 'PAID' } })

            // const driver = await Driver.findById(wallet.driver)


            // const topUpAmount = wallet.amount
            // const ballance = driver.ballance + topUpAmount
            // const updateResponse = await Driver.updateOne({ _id: wallet.driver }, { ballance })
            // const transaction = await WalletHistory.updateOne({
            //     _id: wallet._id
            // }, {
            //     $set: {
            //         status: 'paid',
            //         'telebirr.status': 'paid',
            //         currentAmount: ballance
            //     }
            // })
            // const loans = await Loan.find({ to: wallet.driver, paid: false })

            // for (const unpaidLoan of loans) {
            //     const { ballance } = await Driver.findById(wallet.driver)

            //     if (ballance > unpaidLoan.amount) {
            //         const newBalance = ballance - unpaidLoan.amount
            //         try {
            //             await Driver.updateOne({ _id: unpaidLoan.to }, { ballance: newBalance })
            //             logger.info(`Driver => top up, amount = ${topUpAmount} , balance = ${newBalance}`)
            //         } catch (error) {
            //             logger.error('Top up => ' + error.toString())
            //         }

            //         const secondDriver = await Driver.findById(unpaidLoan.from)
            //         if (secondDriver) {
            //             secondDriver.ballance = secondDriver.ballance + unpaidLoan.amount
            //             await secondDriver.save()
            //             await WalletHistory.create({
            //                 driver: unpaidLoan.from,
            //                 reason: 'Wallet loan pay back',
            //                 by: 'System',
            //                 amount: unpaidLoan.amount,
            //                 from: unpaidLoan.to,
            //                 deposit: wallet.deposit
            //             })
            //             await WalletHistory.create({
            //                 driver: unpaidLoan.to,
            //                 reason: 'Wallet loan pay back',
            //                 by: 'System',
            //                 amount: -1 * unpaidLoan.amount,
            //                 from: unpaidLoan.from,
            //                 deposit: wallet.deposit
            //             })
            //         }

            //         unpaidLoan.paid = true
            //         await unpaidLoan.save()
            //     }
            // }


            // var topUpAmount = req.body.amount;

            return res.contentType('text/html').send(generateC2BPaymentConfirmationResult(`${ThirdPartyTransID} has been confirmed`));

        } catch (err) {
            console.log(err)
            return res.status(500).send("invalid request")
        }



    } catch (err) {
        console.log("telebirr payment query:", err)
        return res.status(500).send(err)
    }

})

module.exports = router