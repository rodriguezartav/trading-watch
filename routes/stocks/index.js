var express = require("express");
var router = express.Router();
const Knex = require("../../helpers/knex");
const moment = require("moment");
const superagent = require("superagent");
const Slack = require("../../helpers/slack");
const FinHub = require("../../helpers/finhub");

const knex = Knex();

router.get("/", async function (req, res) {
  const stocks = await knex.table("stocks").select();
  return res.send(stocks);
});

router.post("/", async function (req, res) {
  let body = {
    ...req.body,
    price_today_open: 0,
    price: 0,
    amount: 0,
    average_price: 0,
    macd_d_hist: 0,
    macd_5_hist: 0,
    price_delta_1: 0,
    price_delta_5: 0,
    price_delta_30: 0,
    price_delta_90: 0,
    price_delta_d: 0,
    roc_5: 0,
    rsi_5: 0,
    today_prices: "",
    importance: 0,
    last_price_update_at: moment().toISOString(),
    price_today_open: 0,
    price_delta_2d: 0,
    rsi_d: 0,
    ema_d_200: 0,
    macd_30_hist: 0,
    rsi_30: 0,
    ema_d_50: 0,
    month_prices: "",
    minute_prices_deltas: "[]",
    price_delta_3d: 0,
    price_delta_4d: 0,
    price_delta_5d: 0,
    price_delta_6d: 0,
  };

  const ids = await knex.table("stocks").insert(body).returning("id");

  return res.send({ id: ids[0], ...body });
});

router.all("/:symbol/:resolution", async function (req, res) {
  let start_date = req.body.start_date;
  if (!start_date) {
    if (req.params.resolution == "1")
      start_date = moment().utcOffset(-4).add(-5, "hours").unix();
    else if (req.params.resolution == "5")
      start_date = moment().utcOffset(-2).startOf("day").unix();
    else if (req.params.resolution == "15")
      start_date = moment().utcOffset(-4).startOf("day").unix();
    else if (req.params.resolution == "30")
      start_date = moment().utcOffset(-4).add(-3, "days").unix();
    else if (req.params.resolution == "60")
      start_date = moment().utcOffset(-4).add(-7, "days").unix();
    else if (req.params.resolution == "D")
      start_date = moment().utcOffset(-4).add(-31, "months").unix();
    else if (req.params.resolution == "W")
      start_date = moment().utcOffset(-4).add(-3, "months").unix();
    else if (req.params.resolution == "M")
      start_date = moment().utcOffset(-4).add(-6, "months").unix();
  }

  const candles = await FinHub(
    "stockCandles",
    req.params.symbol,
    req.params.resolution,
    start_date,
    moment().unix(),
    {}
  );
  return res.json(candles);
});

module.exports = router;
