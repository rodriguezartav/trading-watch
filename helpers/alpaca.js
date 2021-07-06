const request = require("superagent");

function data(url) {
  return request
    .get(`https://data.alpaca.markets/v2/${url}`)
    .set("APCA-API-KEY-ID", process.env.APCA_API_KEY_ID)
    .set("APCA-API-SECRET-KEY", process.env.APCA_API_SECRET_KEY);
}

function account() {
  return request
    .get(`https://api.alpaca.markets/v2/account`)
    .set("APCA-API-KEY-ID", process.env.APCA_API_KEY_ID)
    .set("APCA-API-SECRET-KEY", process.env.APCA_API_SECRET_KEY);
}

function position(symbol) {
  return request
    .get(`https://api.alpaca.markets/v2/positions/${symbol}`)
    .set("APCA-API-KEY-ID", process.env.APCA_API_KEY_ID)
    .set("APCA-API-SECRET-KEY", process.env.APCA_API_SECRET_KEY);
}

function order(symbol) {
  let url = `https://api.alpaca.markets/v2/orders`;
  if (symbol) url += "/" + symbol;

  return request
    .get(url)
    .set("APCA-API-KEY-ID", process.env.APCA_API_KEY_ID)
    .set("APCA-API-SECRET-KEY", process.env.APCA_API_SECRET_KEY);
}

function quote(symbol) {
  return request
    .get(`https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`)
    .set("APCA-API-KEY-ID", process.env.APCA_API_KEY_ID)
    .set("APCA-API-SECRET-KEY", process.env.APCA_API_SECRET_KEY);
}

module.exports = { data, account, position, quote, order };
