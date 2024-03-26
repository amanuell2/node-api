const Reward = require('../models/Reward');
const Passenger = require('../models/User');
const RewardPrize = require('../models/RewardPrize');
const RewardPackage = require('../models/RewardPackage');
const Incentive = require('../models/Incentive');
const Token = require('../models/Token');
const logger = require('../services/logger');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');
const { ObjectId } = require('mongoose').Types

const index = (req, res) => {
    try {
        var page = 1;
        var skip = 0;
        var limit = 20;
        var nextPage;
        var prevPage;
        var filter = {};

        if (req.query.status && req.query.status != null && req.query.status != 'all') {
            filter['status'] = {
                $regex: req.query.status, $options: "i"
            };
        }

        if (req.query.from || req.query.to)
            filter['createdAt'] = filterByTimeRange(req.query.from, req.query.to)

        var rewards = Reward.find(filter);
        if (req.query.page && parseInt(req.query.page) != 0) {
            page = parseInt(req.query.page);
        }
        if (req.query.limit) {
            limit = parseInt(req.query.limit);
        }

        if (page > 1) {
            prevPage = page - 1;
        }

        skip = (page - 1) * limit;

        rewards.sort({ createdAt: 'desc' });
        rewards.limit(limit);
        rewards.skip(skip);

        rewards.populate('passenger').populate('prize')

        Promise.all([
            Reward.countDocuments(filter),
            rewards.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Reward History => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward History => " + error.toString());
        res.status(500).send(error);
    };
};

const claimReward = async (req, res) => {
    try {
        // const savedDriver = await RewardPrize.create(req.body)
        // res.send(savedDriver)
        const authHeader = req.headers.authorization

        if (authHeader) {
            const [scheme, tokenSection] = authHeader.split(' ')

            if (scheme === 'Bearer' && tokenSection) {
                const accessToken = tokenSection

                const token = await Token.findById(accessToken).populate('passenger')
                if (token && token.active && token.passenger) {
                    const passenger = token.passenger

                    const rewardPackage = await RewardPackage.findById(req.body.rewardPackage).populate('prizes')

                    if (rewardPackage) {

                        if (rewardPackage.minimumWalletAmountToQualify < passenger.balance) {

                            const availablePrizes = rewardPackage.prizes.filter(prize => prize.amountInStock > 0)

                            const randomPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)]

                            if (randomPrize) {
                                const prize = await RewardPrize.findById(randomPrize._id)

                                if (prize.amountInStock >= 1) {

                                    const awardedPrize = await Reward.create({
                                        passenger: passenger._id,
                                        prize: prize._id,
                                    })
                                    await RewardPrize.findByIdAndUpdate(prize._id, {
                                        $inc: {
                                            amountInStock: -1
                                        }
                                    })

                                    await Incentive.create({
                                        passenger: passenger._id,
                                        amount: -1 * rewardPackage.minimumWalletAmountToQualify,
                                        reason: `Reward Purchase: ${rewardPackage.minimumWalletAmountToQualify} Birr`
                                    })

                                    await Passenger.findByIdAndUpdate(passenger._id, {
                                        $inc: { 
                                            balance: -1 * rewardPackage.minimumWalletAmountToQualify
                                        }
                                    }) // TODO: verify this logic...

                                    return res.status(200).json({
                                        ...awardedPrize._doc,
                                        prize: prize
                                    })
                                } else {
                                    return res.status(400).send('please try again')
                                }
                            } else {
                                return res.status(400).send('the prize has run out of stock')
                            }
                        } else {
                            return res.status(400).send('you dont have enough balance for the prize')
                        }

                    } else {
                        return res.status(400).send('reward package not found')
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

    } catch (error) {
        console.log(error)
        logger.error('Reward Prize Inventory => ' + error.toString())
        res.status(500).send(error)
    }
}

const myRewards = async (req, res) => {
    try {
        const authHeader = req.headers.authorization

        if (authHeader) {
            const [scheme, tokenSection] = authHeader.split(' ')

            if (scheme === 'Bearer' && tokenSection) {
                const accessToken = tokenSection

                const token = await Token.findById(accessToken).populate('passenger')
                if (token && token.active && token.passenger) {
                    const passenger = token.passenger

                    const prevRewards = await Reward.find({
                        passenger: passenger._id
                    }).limit(req.query.limit ? Number(req.query.limit) : 20).populate('prize')

                    res.status(200).send(prevRewards)
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
        logger.error('my rewards => ' + err.toString())
        res.status(500).send('internal error')
    }
}

const changeStatus = async (req, res) => {
    try {
        const updatedPrize = await Reward.findByIdAndUpdate(req.params.id, {
            status: req.body.status
        })
        res.send(updatedPrize)
    } catch (error) {
        logger.error('Reward Prize Inventory => ' + error.toString())
        res.status(500).send(error)
    }
}

const exportReport = (req, res) => {
    try {
        var filter = {};

        if (req.query.status != null && req.query.status != 'all') {
            filter['status'] = {
                $regex: req.query.status, $options: "i"
            };
        }

        if (req.query.driver != null && req.query.driver != 'all') {
            filter['driver'] = req.query.driver;
        }

        if (req.query.passenger != null && req.query.passenger != 'all') {
            filter['passenger'] = req.query.passenger;
        }

        console.log(req.query.passenger)
        filter['pickupTimestamp'] = filterByTimeRange(req.query.start, req.query.end)

        var trip = Reward.find(filter);

        trip.populate()
        trip.sort({ pickupTimestamp: 'desc' });

        ["driver", "passenger", "vehicleType", "dispatcher"].forEach(model => trip.populate(model))

        trip.exec().then((tripRecords) => {
            const reportData = [
                [
                    "Dispatcher",
                    "Scheduled",
                    "Passenger Name",
                    "Driver Name",
                    "Pickup / End Time",
                    "Pick / Drop Address",
                    "Type",
                    "Vehicle Type",
                    "Status",
                ].join("\t"),
                ...tripRecords.map(({
                    dispatcher,
                    schedule,
                    passenger,
                    driver,
                    pickupTimestamp,
                    endTimestamp,
                    pickUpAddress,
                    dropOffAddress,
                    vehicleType,
                    type,
                    status,
                }) => [
                    dispatcher ? dispatcher.firstName +
                        " " +
                        dispatcher.lastName
                        : " - ",
                    schedule ? "Scheduled" : "Now",
                    passenger ? passenger.firstName + " " + passenger.lastName
                        : "Unknown",

                    driver
                        ? driver.fullName
                        : "Unknown",

                    [
                        pickupTimestamp
                            ? pickupTimestamp
                            : "Canceled trip",

                        endTimestamp
                            ? endTimestamp
                            : "Canceled trip",
                    ].join(' -> '),

                    [
                        pickUpAddress.name,
                        dropOffAddress.name
                    ].join(' -> '),

                    type,

                    vehicleType ? vehicleType.name : "-",

                    status,

                ].join('\t'))
            ].join('\n')

            generateAndSendReport({
                req,
                res,
                fileName: 'generated-report-trips.xls',
                fileData: reportData
            })

        }).catch((error) => {
            logger.error("Reward History => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward History => " + error.toString());
        res.status(500).send(error);
    };
};

module.exports = { index, exportReport, claimReward, myRewards, changeStatus };
