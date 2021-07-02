var express = require("express");
var router = express.Router();
const Knex = require("../../helpers/knex");
const moment = require("moment");
const superagent = require("superagent");
const Slack = require("../../helpers/slack");
const FinHub = require("../../helpers/finhub");

const knex = Knex();

router.all("/:symbol/:resolution", async function (req, res, next) {
  let start_date = req.body.start_date;
  if (!start_date) {
    if (req.params.resolution == "1")
      start_date = moment().utcOffset(-4).add(-5, "hours").unix();
    else if (req.params.resolution == "5")
      start_date = moment().utcOffset(-4).startOf("day").unix();
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
