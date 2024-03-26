const Setting = require('../models/Setting')
const logger = require('../services/logger')

const get = async (req, res) => {
  try {
    const setting = (await Setting.findOne({}))._doc;
    setting.voucherSettings = {
      ...setting.voucherSettings._doc,
      password: "",
      passwordIsSet: !!(setting.voucherSettings._doc.password && setting.voucherSettings._doc.password.length)
    }
    res.send(setting || {})
  } catch (error) {
    logger.error('Setting => ' + error.toString())
    res.status(500).send(error)
  }
}

const add = async (req, res) => {
  let setting = null
  try {
    setting = await Setting.findOne({})
  } catch (error) {
    logger.error('Setting => ' + error.toString())
  }

  if (setting) {
    try {
      if (!req.body.voucherSettings.password)
        req.body.voucherSettings.password = setting.voucherSettings.password;
      const updatedSetting = await Setting.updateOne({ _id: setting._id }, req.body)
      res.send(updatedSetting)
    } catch (error) {
      logger.error('Setting => ' + error.toString())
      res.status(500).send(error)
    }
  } else {
    try {
      const savedSetting = await Setting.create(req.body)
      res.send(savedSetting)
    } catch (error) {
      logger.error('Setting => ' + error.toString())
      res.status(500).send(error)
    }
  }
}

module.exports = { get, add }
