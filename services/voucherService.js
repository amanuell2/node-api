const { default: axios } = require('axios')
const logger = require('./logger')
const Setting = require('../models/Setting')
require('dotenv/config')

const getVoucher = async (amount) => {
  const setting = await Setting.findOne()

  const config = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const VOUCHER_DOMAIN = setting.voucherSettings.domain
  const voucherTypeId = setting.voucherSettings.voucherTypes.find((x) => x.amount == amount).id
  const { username, password } = setting.voucherSettings

  try {
    const authResult = await axios.post(`${VOUCHER_DOMAIN}/api/user_accounts/login`, {
      username,
      password
    }, config)

    const voucherResult = await axios.get(`${VOUCHER_DOMAIN}/api/vouchers/get-voucher?voucherTypeId=${voucherTypeId}&quantity=1&print=true&access_token=${authResult.data.accessToken}`, config)

    if (voucherResult.data && voucherResult.data.length) {
      return voucherResult.data[0]
    } else {
      throw new Error('voucher couldn\'t be fetched')
    }
    // return {
    //     "voucher": "67608533482947",
    //     "serialNumber": "2911478182",
    //     "expirationDate": "2021-06-21T00:00:00.000Z"
    // }
  } catch (error) {
    console.log(error)
    throw new Error('voucher couldn\'t be fetched')
  }
}

module.exports = { getVoucher }
