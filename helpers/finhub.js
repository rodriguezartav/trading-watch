require("dotenv").config();
const util = require("util");
const request = require("superagent");
const Finnhub = require("finnhub");

const api_key = Finnhub.ApiClient.instance.authentications["api_key"];
api_key.apiKey = process.env.FINHUB_API; // Replace this
const finnHubClient = new Finnhub.DefaultApi();

function Run(fnName, ...params) {
  return util.promisify(finnHubClient[fnName]).apply(finnHubClient, params);
}

async function Indicator(
  symbol,
  indicator,
  resolution,
  from,
  to,
  options = {}
) {
  const body = {
    symbol,
    resolution,
    from,
    to,
    indicator,
    token: process.env.FINHUB_API,
    ...options,
  };

  try {
    const response = await request
      .get(`https://finnhub.io/api/v1/indicator`)
      .query(body);

    return response.body;
  } catch (e) {
    console.log(e);
    return { t: [], [indicator]: [] };
  }
}

async function Candles(symbol, resolution, from, to, options = {}) {
  const body = {
    symbol,
    resolution,
    from,
    to,
    token: process.env.FINHUB_API,
    ...options,
  };

  try {
    const response = await request
      .get(`https://finnhub.io/api/v1/stock/candle`)
      .query(body);

    return response.body;
  } catch (e) {
    console.log(e);
    return { t: [], [indicator]: [] };
  }
}

async function Candles(symbol, resolution, from, to, options = {}) {
  const body = {
    symbol,
    resolution,
    from,
    to,
    token: process.env.FINHUB_API,
    ...options,
  };

  try {
    const response = await request
      .get(`https://finnhub.io/api/v1/stock/candle`)
      .query(body);

    return response.body;
  } catch (e) {
    console.log(e);
    return { t: [], c: [] };
  }
}

async function News(symbol, resolution, from, to, options = {}) {
  const body = {
    symbol,
    resolution,
    from,
    to,
    token: process.env.FINHUB_API,
    ...options,
  };

  try {
    const response = await request
      .get(`https://finnhub.io/api/v1/stock/candle`)
      .query(body);

    return response.body;
  } catch (e) {
    console.log(e);
    return { t: [], c: [] };
  }
}

async function Aggregate(symbol, resolution, from, to, options = {}) {
  const body = {
    symbol,
    resolution,
    from,
    to,
    token: process.env.FINHUB_API,
    ...options,
  };

  try {
    const response = await request
      .get(`https://finnhub.io/api/v1/stock/candle`)
      .query(body);

    return response.body;
  } catch (e) {
    console.log(e);
    return { t: [], c: [] };
  }
}

Run.Indicator = Indicator;
Run.Candles = Candles;

module.exports = Run;
