const redisAdapter = require('socket.io-redis')
const socketIO = require('socket.io')

let io;

module.export = {
    set: (server) => {
     io = socketIO(server, {
        cors: {
          origin: '*',
          credentials: true,
          methods: ["GET", "POST"],
          transports: [
            'websocket'
          ],
        },
        allowEIO3: true,
        transports: [
          'websocket'
        ]
      })
      
      io.adapter(redisAdapter({ host: 'ilift-redis-refactored', port: 6379 }))
      
      // io.set('origins', '*:*');
    //   setIO(io)
    }
}