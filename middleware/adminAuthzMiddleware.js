const Token = require('../models/Token')
const Role = require('../models/Role')
const { ObjectId } = require('mongoose').Types;
const ROLES = require('../utils/roles');
const CorporateRole = require('../models/CorporateRole');
const { firebaseAuth } = require('../services/firebase')

module.exports = (permissionsRequired) => {
  return (req, res, next) => {
    // let enabledRoles = [];

    if(permissionsRequired.hasFirebaseToken && req.body && req.body.firebaseToken) {
      return firebaseAuth()
        .verifyIdToken(req.body.firebaseToken)
        .then(async (decodedToken) => { next()})
        .catch(() => res.status(403).send("unauthorized"))
    }

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
        if (token.account) {
          if (!token.corporateRole && !token.role) {
            return res.status(403).send("role not specified")
          }
        }
        // console.log("token.passenger", token.passenger)
        // console.log("permissionsRequired.passenger", permissionsRequired.passenger)
        // console.log("token.driver", token.driver)
        // console.log("permissionsRequired.driver", permissionsRequired.driver)
        // console.log("token.corporateRole", token.corporateRole)
        // console.log("token.role", token.role)
        // console.log("token.account", token.account)

        if (token.account && token.corporateRole) {
          const role = await CorporateRole.findOne({ _id: ObjectId(token.corporateRole) })

          if (!role) {
            return res.status(403).send("ROLE_NOT_FOUND")
          }

          if (!token.account.active) {
            return res.status(401).send('ACCOUNT_DEACTIVATED')
          }

          res.locals.user = token.account


          const rolePermissionsJSON = role.permissions.toJSON()
          // console.log(" >>> ", permissionsRequired)
          for (let [moduleName, requiredPermissions] of Object.entries(permissionsRequired.corporate || [])) {
            requiredPermissions = requiredPermissions && requiredPermissions.length ? requiredPermissions : []
            if (!(rolePermissionsJSON[moduleName])) return res.status(403).send('INSUFFICENT_PREVILEGES');
            // if (!requiredPermissions.length) canAccess = false;
            for (const permission of requiredPermissions) {
              if (!rolePermissionsJSON[moduleName][permission]) {
                return res.status(403).send('INSUFFICENT_PREVILEGES');
              }
            }

          }

          return next();
        } else if (token.active) {

          if (token.account && token.role) {
            const role = await Role.findOne({ _id: ObjectId(token.role) })

            if (!role) {
              return res.status(403).send("ROLE_NOT_FOUND")
            }

            if (!token.account.active) {
              return res.status(401).send('ACCOUNT_DEACTIVATED')
            }

            res.locals.user = token.account


            const rolePermissionsJSON = role.permissions.toJSON()
            // console.log(" >>> ", permissionsRequired)
            for (let [moduleName, requiredPermissions] of Object.entries(permissionsRequired.account)) {
              requiredPermissions = requiredPermissions && requiredPermissions.length ? requiredPermissions : []
              if (!(rolePermissionsJSON[moduleName])) return res.status(403).send('INSUFFICENT_PREVILEGES');
              // if (!requiredPermissions.length) canAccess = false;
              for (const permission of requiredPermissions) {
                if (!rolePermissionsJSON[moduleName][permission]) {
                  return res.status(403).send('INSUFFICENT_PREVILEGES');
                }
              }

            }

            return next();
          }
          else if (token.driver && permissionsRequired.driver) {
            // console.log("driver is allowed")

            return next();
          }
          else if (token.passenger && permissionsRequired.passenger) {
            // console.log("passenger is allowed")
            return next();
          }
          else {
            res.status(401).send('UNAUTHORIZED')
          }
          // if (enabledRoles) {
          //   if (
          //     // enabledRoles.includes(token.role) || 
          //     (token.account && token.account.roles.some(value => enabledRoles.includes(value) && token.account.active) ||
          //       (enabledRoles.includes(ROLES.DRIVER) && token.driver) ||
          //       (enabledRoles.includes(ROLES.PASSENGER) && token.passenger))
          //   ) {
          //     res.locals.user = token.account
          //     next()
          //   } else {
          //     res.status(403).send('Insufficient Permission')
          //   }
          // } else {
          //   next()
          // }
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
