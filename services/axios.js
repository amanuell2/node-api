const axios = require('axios')

const MAX_NUM_OF_TRIAL = 5

async function makeRequest(request, retry = 0) {
    try {
        return await axios(request, {
            timeout: 15000
        });
    } catch (err) {
        if (retry < MAX_NUM_OF_TRIAL) {
            return await makeRequest(request, retry + 1);
        } else {
            throw err
        }
    }
}

module.exports = {
    makeRequest
}