const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");
const { delay, priceDiff } = require("../helpers/utils");
const Slack = require("../helpers/slack");

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

      const macd_d = await FinHub(
        "technicalIndicator",
        stock.name,
        "D",
        moment().add(-120, "days").unix(),
        moment().unix(),
        "macd",
        {}
      );

      const rsi_d = await FinHub(
        "technicalIndicator",
        stock.name,
        "D",
        moment().add(-120, "days").unix(),
        moment().unix(),
        "rsi",
        { timeperiod: 14 }
      );

      const ema_d_50 = await FinHub.Indicator(
        stock.name,
        "ema",
        "D",
        moment().add(-120, "days").unix(),
        moment().unix(),

        { timeperiod: 50 }
      );

      const ema_d_200 = await FinHub.Indicator(
        stock.name,
        "ema",
        "D",
        moment().add(-320, "days").unix(),
        moment().unix(),

        { timeperiod: 200 }
      );

      const lastIndex = macd_d.t.length - 1;

      stock.price_delta_2d = priceDiff(
        macd_d.o[lastIndex - 1],
        macd_d.o[lastIndex]
      );

      stock.month_prices = JSON.stringify(macd_d.c.slice(-30));

      stock.macd_d_hist = macd_d.macdHist[lastIndex];
      stock.rsi_d = rsi_d.rsi[lastIndex];
      stock.ema_d_200 = ema_d_200.ema[ema_d_200.ema.length - 1];
      stock.ema_d_50 = ema_d_50.ema[ema_d_50.ema.length - 1];

      let macdChangeIndex = -1;
      macd_d.macdHist.forEach((macd, index) => {
        if (index == 0) return;
        const lastMacd = macd_d.macdHist[index - 1];
        if (macd > 0.001 && lastMacd < 0.001) macdChangeIndex = index;
        else if (macd < 0.001 && lastMacd > 0.001) macdChangeIndex = index;
      });
      stock.macd_d_last_cross = moment
        .unix(
          macdChangeIndex == -1
            ? moment().add(-120, "days").unix()
            : macd_d.t[macdChangeIndex]
        )
        .toISOString();

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
