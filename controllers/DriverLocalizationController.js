const Localization = require('../models/DriverLocalization')
const logger = require('../services/logger')

const { ObjectId } = require('mongoose').Types

const index = async (req, res) => {
    try {
        const localizations = await Localization.find({}, 'name');

        res.send(localizations)
    } catch (error) {
        logger.error('Localization => ' + error.toString())
        res.status(500).send(error)        
    }
}

const get = async (req, res) => {
  try {
    const localization = await Localization.findOne({
        name: req.params.code
    });

    if (localization)
        res.send(localization)
    else
        res.status(404).send('not found')
  } catch (error) {
    logger.error('Localization => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
    try {
        const updatedLocalization = await Localization.updateOne({ _id: ObjectId(req.params.id) }, {$set: {data: req.body}})
        res.send(updatedLocalization)
    } catch (error) {
        logger.error('Localization => ' + error.toString())
        res.status(500).send(error)
    }
}

const remove = async (req, res) => {
    try {
        const deletedLocalization = await Localization.deleteOne({ _id: ObjectId(req.params.id) })
        res.send(deletedLocalization)
    } catch (error) {
        logger.error('Localization => ' + error.toString())
        res.status(500).send(error)
    }
}

module.exports = { get, update, index, remove }