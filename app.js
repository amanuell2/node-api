const express = require("express");
require("dotenv/config");
// const https = require('https');
const http = require("http");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const socketIO = require("socket.io");
const { setIO } = require("./sockets/io");
// const { runCrone } = require('./services/cronService');
const logger = require("./services/logger");
const Token = require("./models/Token");

const redisAdapter = require("socket.io-redis");

const { ObjectId } = require("mongoose").Types;

const socketEvents = require("socket.io-events");

// const authz = require('./authorization/rbac')

// authz.then(rbac => {
//   console.log(rbac)
// })

// const fs = require('fs');

rDate = Date;

Date = class extends Date {
  constructor(options) {
    if (options) {
      super(options);
    } else {
      super(Date.now() + 1000 * 60 * 60 * 3);
    }
  }
};

const app = express();

// Enable CORS for all routes
app.use(cors());

app.disable("x-powered-by");

app.use(helmet());

// const server = https.createServer({
//   key: fs.readFileSync('./ilift-key.pem'),
//   cert: fs.readFileSync('./ilift-cert.crt'),
// }, app);
let io;
const server = http.createServer(app);
// require('./socketio')(server)
try {
  io = socketIO(server, {
    cors: {
      origin: "*",
      credentials: true,
      methods: ["GET", "POST"],
      transports: ["websocket"],
    },
    allowEIO3: true,
    transports: ["websocket"],
  });

  io.adapter(redisAdapter({ host: "ilift-redis-refactored", port: 6379 }));
  // console.log("APP PID:", process.pid)

  // console.log("IO", io)
  // io.set('origins', '*:*');
  setIO(io);
} catch (err) {
  console.log(err);
}
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.use(function (req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log("[api]]\n", ip, "==>", req.originalUrl, "\n");
  next();
});

// Connecting to mongoDB
mongoose.connect(
  process.env.DB_CONNECTION,
  {
    // user: process.env.DB_USERNAME, pass: process.env.DB_PASSWORD,
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  },
  (error, res) => {
    if (error) logger.error(error.toString());
    if (res) logger.info("DB connected");
  }
);

var gracefulExit = function () {
  mongoose.connection.close(function () {
    console.log(
      "Mongoose default connection with DB :" +
        db_server +
        " is disconnected through app termination"
    );
    process.exit(0);
  });
};

// If the Node process ends, close the Mongoose connection
process.on("SIGINT", gracefulExit).on("SIGTERM", gracefulExit);
// Routes
app.use("/", require("./routes/core"));
app.use("/setting", require("./routes/settings"));
app.use("/driver-localizations", require("./routes/driver-localizations"));
app.use(
  "/passenger-localizations",
  require("./routes/passenger-localizations")
);
app.use("/tickets", require("./routes/tickets"));
app.use("/notifications", require("./routes/notifications"));
app.use("/corporates", require("./routes/corporates"));
app.use("/employees", require("./routes/employees"));
app.use("/corporate-payments", require("./routes/corporatePayments"));
app.use("/trips", require("./routes/trips"));
app.use("/trip-requests", require("./routes/trip-request"));
app.use("/trip-searches", require("./routes/trip-search"));
app.use("/rents", require("./routes/rents"));
app.use("/drivers", require("./routes/drivers"));
app.use("/drivers-finance", require("./routes/drivers-finance"));
app.use("/users", require("./routes/users"));
app.use("/logs", require("./routes/logs"));
app.use("/sos", require("./routes/sos")(io));
app.use("/vehicles", require("./routes/vehicles"));
app.use("/wallet-histories", require("./routes/walletHistories"));
app.use("/incentives", require("./routes/incentives"));
app.use("/loan-histories", require("./routes/loanHistories"));
app.use("/vehicleTypes", require("./routes/vehicleTypes"));
app.use("/accounts", require("./routes/accounts"));
app.use("/rewards-inventory", require("./routes/rewards-inventory"));
app.use("/reward-packages", require("./routes/reward-packages"));
app.use("/rewards", require("./routes/rewards"));
app.use("/promos", require("./routes/promo"));
app.use("/mock-reports", require("./routes/mock-reports"));

app.use("/api", require("./routes/telebirr"));

// Driver Socket
const ds = require("./sockets/DriverSocket");

const driverSocket = io.of(/driver\-socket.?/);

// const driverRouter = socketEvents()
/*
driverRouter.on('*', async ({ sock }, args, next) => {
  try {
    if (sock.handshake.query && sock.handshake.query.token) {
      const { token } = sock.handshake.query

      try {
        const persistedToken = await Token.findOne({ _id: ObjectId(token), active: true }).populate('driver');

        console.log("RECEIVED TOKEN:", token)

        if (persistedToken && persistedToken.active && persistedToken.driver) {
          return next()
        } else {
          console.log("INVALID TOKEN")
          return sock.emit('error', ({
            message: "unauthorized",
            count: 5
          }))
        }
      } catch (error) {
        return sock.emit('error', ({
          message: "unauthorized",
          count: 5
        }))
      }

    } else {
      return sock.emit('error', ({
        message: "unauthorized",
        count: 5
      }))
    }
  } catch (error) {
    console.log("error")
    console.log(error)
    sock.emit('error', ({
      message: "unauthorized",
      count: 5
    }))
  }

});
*/

driverSocket.on("connection", ds);

// driverSocket.use(driverRouter)

// Passenger Socket
const ps = require("./sockets/PassengerSocket");
const passengerSocket = io.of("/passenger-socket");

// const passengerRouter = socketEvents()
/*passengerRouter.on('*', async ({ sock }, args, next) => {
  try {
    // // Only for the time being
    // return next()
    // sock.emit('pid', (process.pid))
    // return next()
    if (sock.handshake.query && sock.handshake.query.token) {
      const { token } = sock.handshake.query

      try {
        const persistedToken = await Token.findById(token).populate('passenger')

        console.log('RECEIVED TOKEN:', token)

        if (persistedToken && persistedToken.active && persistedToken.passenger) {
          return next()
        } else {
          console.log('INVALID TOKEN')
          return sock.emit("unauthorized")
        }
      } catch (error) {
        return sock.emit("unauthorized")
      }
    } else {
      return sock.emit("unauthorized")
    }
  } catch (error) {
    console.log('error')
    console.log(error)
    sock.emit("unauthorized")
  }
})
*/
passengerSocket.on("connection", ps);

// passengerSocket.use(passengerRouter)

// Dispatcher Socket
const dis = require("./sockets/DispatcherSocket");

const dispatcherSocket = io.of("/dispatcher-socket");

const dispatcherRouter = socketEvents();

// dispatcherRouter.on('*', async ({ sock }, args, next) => {
//   try {
//     if (sock.handshake.query && sock.handshake.query.token) {
//       const { token } = sock.handshake.query

//       try {
//         const persistedToken = await Token.findOne({ _id: ObjectId(token),  active: true }).populate('dispatcher');

//         console.log("RECEIVED TOKEN:", token)

//         if (persistedToken && persistedToken.active && persistedToken.dispatcherRouter) {
//           return next()
//         } else {
//           console.log("INVALID TOKEN")
//           return sock.emit('error', JSON.stringify({
//             message: "unauthorized",
//             count: 5
//           }))
//         }
//       } catch (error) {
//         return sock.emit('error', JSON.stringify({
//           message: "unauthorized",
//           count: 5
//         }))
//       }

//     } else {
//       return sock.emit('error', JSON.stringify({
//         message: "unauthorized",
//         count: 5
//       }))
//     }
//   } catch (error) {
//     console.log("error")
//     console.log(error)
//     sock.emit('error', JSON.stringify({
//       message: "unauthorized",
//       count: 5
//     }))
//   }

// });

dispatcherSocket.on("connection", dis);

dispatcherSocket.use(dispatcherRouter);

// SOS Socket
const ss = require("./sockets/SosSocket");
const sosSocket = io.of("/sos-socket");
sosSocket.on("connection", ss);

// // Start cron
// runCrone(io);

// Listening
const PORT = 8000;

server.listen(PORT, () => logger.info("LISTENING ON PORT " + PORT));
