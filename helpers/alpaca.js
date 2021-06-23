const request = require("superagent");

function data(url){
    return request.get(`https://data.alpaca.markets/v2/${url}`).set("APCA-API-KEY-ID",process.env.APCA_API_KEY_ID).set(
    "APCA-API-SECRET-KEY",process.env.APCA_API_SECRET_KEY)
}

module.exports = {data}