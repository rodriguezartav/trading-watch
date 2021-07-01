const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");
const {
  delay,
  priceDiff,
  crossIndex,
  crossRSIIndex,
} = require("../helpers/utils");
const Slack = require("../helpers/slack");
const Orders = require("../helpers/orders");

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

      const rsi_5 = await FinHub(
        "technicalIndicator",
        stock.name,
        "5",
        moment().add(-1, "days").unix(),
        moment().unix(),
        "rsi",
        {}
      );

      const macd_5 = await FinHub(
        "technicalIndicator",
        stock.name,
        "5",
        moment().add(-1, "days").unix(),
        moment().unix(),
        "macd",
        {}
      );

      if (!macd_5.t) {
        console.log("NOTICE", stock.name, "has no macd5 data");
        return stock;
      }
      const lastIndex5 = macd_5.t.length - 1;

      const currentHigh = macd_5.h[lastIndex5];
      const currentOpen = macd_5.o[lastIndex5];
      const currentClose = macd_5.c[lastIndex5];

      const high30 = macd_5.h[lastIndex5 - 6];
      const open30 = macd_5.o[lastIndex5 - 6];
      const close30 = macd_5.c[lastIndex5 - 6];

      const high90 = macd_5.h[lastIndex5 - 18];
      const open90 = macd_5.o[lastIndex5 - 18];
      const close90 = macd_5.c[lastIndex5 - 18];

      stock.price_delta_5 = priceDiff(currentOpen, currentClose);
      stock.price_delta_30 = priceDiff(open30, currentClose);
      stock.price_delta_90 = priceDiff(open90, currentClose);
      // stock.macd_5_hist = macd_5.macdHist[lastIndex5];
      stock.rsi_5 = rsi_5.rsi[lastIndex5];

      const macdCross = crossIndex(macd_5.macdHist);
      rsiCross = crossRSIIndex(rsi_5.rsi);

      if (macdCross == 0) {
        await Orders.createOrder(
          stock,
          macd_5.macdHist > 0 ? "LONG" : "SHORT",
          currentClose,
          "MACD CROSS",
          `${stock.name} MACD Cross`
        );
      }
      if (rsiCross == 0) {
        await Orders.createOrder(
          stock,
          rs > 0 ? "LONG" : "SHORT",
          currentClose,
          "RSI CROSS",
          `${stock.name} MACD Cross`
        );
      }

      if (Math.abd(stock.price_delta_5) > 1) {
        await Orders.createOrder(
          stock,
          stock.price_delta_5 > 0 ? "LONG" : "SHORT",
          currentClose,
          "5 Min Price",
          `${stock.name} ${stock.price_delta_5} % in 5 minutes`
        );
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
