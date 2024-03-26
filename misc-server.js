const express = require('express')
require('dotenv/config')
const http = require('http')
const path = require('path')
const mongoose = require('mongoose')
const logger = require('./services/logger')
const morgan = require('morgan')
const helmet = require('helmet')

rDate = Date

Date = class extends Date {
  constructor(options) {
    if (options) {
      super(options)
    } else {
      super(Date.now() + 1000 * 60 * 60 * 3)
    }
  }
}

const app = express()

app.use(helmet())

app.disable('x-powered-by');

const server = http.createServer(app)

// app.use(morgan('combined', { stream: logger.stream }));
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  next()
})

app.use(function (req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  if (!['/date'].includes(req.originalUrl)) {
    console.log('\n[admin-api]', ip, '==>', req.originalUrl, '\n')
  }
  next()
})

// Connecting to mongoDB
mongoose.connect(process.env.DB_CONNECTION, {
  // user: process.env.DB_USERNAME, pass: process.env.DB_PASSWORD,
  useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false
}, (error, res) => {
  if (error) logger.error(error.toString())
  if (res) logger.info('DB connected')
})

// const { authz } = require('casbin-express-authz');

// const rbacEnforcer = require('./authorization/rbac')

// const rules = [
//   ['jack', 'data4', 'read'],
//   ['katy', 'data4', 'write'],
//   ['leyo', 'data4', 'read'],
//   ['ham', 'data4', 'write']
// ];

// (async () => {

// const areRulesAdded = await rbacEnforcer.addPolicies(rules);

// console.log(">>>>>>>>>>>")
// console.log(areRulesAdded)
// })

// class MyAuthorizer {
  
//   constructor(req, res, e) {
//     this.e = e;
//     this.req = req
//     this.res = res
//   }

//   async checkPermission() {
//     // do something
//     console.log("checking permission")
//     console.log(this.req)
//     console.log(this.res)
//     console.log(this.e)
//     return true;
//   }
// }

// app.use(
//   authz({
//     newEnforcer: rbacEnforcer,
//     authorizer: MyAuthorizer,
//   })
// );

app.use('/', require('./routes/core'))
app.use('/setting', require('./routes/settings'))
app.use('/tickets', require('./routes/tickets'))
app.use('/bans', require('./routes/device-ban'));
app.use('/driver-bans', require('./routes/driver-ban'));
app.use('/driver-localizations', require('./routes/driver-localizations'))
app.use('/passenger-localizations', require('./routes/passenger-localizations'))
app.use('/notifications', require('./routes/notifications'))
// app.use('/corporates', require('./routes/corporates'))
app.use('/employees', require('./routes/employees'))
app.use('/roles', require('./routes/roles'))
// app.use('/corporate-payments', require('./routes/corporatePayments'))
app.use('/trips', require('./routes/trips'))
// app.use('/trip-requests', require('./routes/trip-request'))
// app.use('/trip-searches', require('./routes/trip-search'))
app.use('/rents', require('./routes/rents'))
app.use('/drivers', require('./routes/drivers'))
app.use('/drivers-finance', require('./routes/drivers-finance'))
app.use('/users', require('./routes/users'))
app.use('/logs', require('./routes/logs'))
app.use('/vehicles', require('./routes/vehicles'))
app.use('/wallet-histories', require('./routes/walletHistories'))
app.use('/incentives', require('./routes/incentives'))
app.use('/loan-histories', require('./routes/loanHistories'))
app.use('/vehicleTypes', require('./routes/vehicleTypes'))
app.use('/accounts', require('./routes/accounts'))
app.use('/activity-logs', require('./routes/activity-log'))
app.use('/rewards-inventory', require('./routes/rewards-inventory'))
app.use('/reward-packages', require('./routes/reward-packages'))
app.use('/rewards', require('./routes/rewards'))
app.use('/promos', require('./routes/promo'))
app.use('/driver-leaderboard', require('./routes/driver-leaderboard'))
app.use('/passenger-leaderboard', require('./routes/passenger-leaderboard'))
app.use('/mock-reports', require('./routes/mock-reports'))

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // add this line to include winston logging
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  // render the error page
  res.status(err.status || 500).send('error');
});

// Listening
const PORT = 8001
server.listen(PORT, () => logger.info('LISTENING ON PORT ' + PORT))
