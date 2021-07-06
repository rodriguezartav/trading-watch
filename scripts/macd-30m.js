const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");
const {
  delay,
  priceDiff,
  crossRSIIndex,
  crossIndex,
} = require("../helpers/utils");
const Slack = require("../helpers/slack");
const Proposals = require("../helpers/proposals");

async function Run() {
  const knex = await Knex();
  const slack = await Slack();

  process.on("exit", async (code) => {
    console.log("disconnecting");
    await knex.destroy();
    //uncaughtException;
    //unhandledRejection;
  });

  const stocks = await knex.table("stocks").select();
  const stockMap = {};
  stocks.forEach((item) => {
    stockMap[item.name] = item;
  });

  const results = [];

  await stocks.reduce(function (promise, stock, index) {
    return promise.then(async function () {
      // no delay on first iteration
      var delayT = index ? index * 50 : 1;

      const macd_30 = await FinHub(
        "technicalIndicator",
        stock.name,
        "30",
        moment().add(-40, "days").unix(),
        moment().unix(),
        "macd",
        {}
      );

      const rsi_30 = await FinHub(
        "technicalIndicator",
        stock.name,
        "30",
        moment().add(-40, "days").unix(),
        moment().unix(),
        "rsi",
        { timeperiod: 14 }
      );

      const lastIndex = macd_30.t.length - 1;

      stock.macd_30_hist = macd_30.macdHist[lastIndex];
      stock.rsi_30 = rsi_30.rsi[lastIndex];

      if (crossIndex(macd_30.macdHist)) {
      }
      if (crossRSIIndex(rsi_30.rsi)) {
      }

      results.push({ stock });
      return stock;
    });
  }, Promise.resolve());

  await Promise.all(
    results.map(async (stockResult) => {
      return knex
        .table("stocks")
        .update(stockResult.stock)
        .where("id", stockResult.stock.id);
    })
  );

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
