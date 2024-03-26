const express = require('express')
const router = express.Router()
const EmployeeController = require('../controllers/EmployeeController')
const authRequired = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/', EmployeeController.index)

router.get('/:id', EmployeeController.show)

router.post('/',
  // authRequired([
  //   ROLES.CORPORATE
  // ]),
  EmployeeController.store
)

router.patch('/:id',
  // authRequired([
  //   ROLES.CORPORATE
  // ]),
  EmployeeController.update
)

router.delete('/:id',
  // authRequired([
  //   ROLES.CORPORATE
  // ]),
  EmployeeController.remove
)

module.exports = router
