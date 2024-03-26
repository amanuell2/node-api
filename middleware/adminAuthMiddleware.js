const Token = require('../models/Token')
const Role = require('../models/Role')
const { ObjectId } = require('mongoose').Types;
const ROLES = require('../utils/roles')

module.exports = (permissionsRequired) => {
  return (req, res, next) => {
    // let enabledRoles = [];
    let accessToken

    // if (roles && typeof (roles) === typeof ([]) && roles.length) {
    //   enabledRoles = roles
    // }

    if (req.query.token) { // token from queryString (for backward compatability)
      accessToken = req.query.token
    } else { // token from Authorization Header
      const authHeader = req.headers.authorization

      if (authHeader) {
        const [scheme, token] = authHeader.split(' ')

        if (scheme === 'Bearer' && token) {
          accessToken = token
        }
      }
    }

    if (accessToken) {
      Token.findById(accessToken).populate('account').then(async (token) => {
        if (token && token.active) {
            next();
        } else {
          res.status(401).send('UNAUTHORIZED')
        }
      }).catch(err => {
        console.log(err)
        res.status(500).send('Internal Error while trying to authenticate via token')
      })
    } else {
      res.status(401).send('UNAUTHORIZED')
    }
  }
}
