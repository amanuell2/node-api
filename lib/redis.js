const Redis = require('ioredis')
const JSONCache = require('redis-json')

const redis = new Redis({
  host: 'ilift-redis'
})

const jsonCache = new JSONCache(redis, { prefix: 'cache:' })

module.exports = jsonCache
