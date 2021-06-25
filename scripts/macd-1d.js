const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");
const { delay, priceDiff } = require("../helpers/utils");
const Slack = require("../helpers/slack");

async function Run() {
  const knex = await Knex();

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

      const lastIndex = macd_d.t.length - 1;

      const currentHigh = macd_d.h[lastIndex];
      const currentOpen = macd_d.o[lastIndex];
      const currentClose = macd_d.c[lastIndex];

      stock.macd_d_hist = macd_d.macdHist[lastIndex];

      let macdChangeIndex = -1;
      macd_d.macdHist.forEach((macd, index) => {
        if (index == 0) return;
        const lastMacd = macd_d.macdHist[index - 1];
        if (macd > 0 && lastMacd < 0) macdChangeIndex = index;
        else if (macd < 0 && lastMacd > 0) macdChangeIndex = index;
      });
      stock.macd_d_last_cross = moment
        .unix(
          macdChangeIndex == -1
            ? moment().add(-90, "days").unix()
            : macd_d.t[macdChangeIndex]
        )
        .toISOString();

      if (Math.abs(stock.price_delta_d) > 2) {
        const slack = await Slack();
        await slack.chat.postMessage({
          text: `${stock.name} changed ${stock.price_delta_d} % in the last day`,
          channel: slack.generalChannelId,
        });
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
