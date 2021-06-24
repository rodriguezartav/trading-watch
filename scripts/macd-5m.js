const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");
const { delay, priceDiff } = require("../helpers/utils");
const Slack = require("../helpers/slack");

async function Run() {
  const knex = await Knex();
  const slack = await Slack();

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
      const macd_D = await FinHub(
        "technicalIndicator",
        stock.name,
        "D",
        moment().add(-60, "days").unix(),
        moment().unix(),
        "macd",
        {}
      );

      const lastIndexD = macd_D.t.length - 1;
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

      console.log(moment.unix(macd_5.t[lastIndex5]).toISOString());

      stock.price_delta_5 = priceDiff(currentOpen, currentClose);
      stock.price_delta_30 = priceDiff(open30, currentClose);
      stock.price_delta_90 = priceDiff(open90, currentClose);
      stock.macd_5_hist = macd_5.macdHist[lastIndex5];
      stock.macd_d_hist = macd_D.macdHist[lastIndexD];
      stock.rsi_5 = rsi_5.rsi[lastIndex5];

      let macdChangeIndex = -1;
      macd_5.macdHist.forEach((macd, index) => {
        if (index == 0) return;
        const lastMacd = macd_5.macdHist[index - 1];
        if (macd > 0 && lastMacd < 0) macdChangeIndex = index;
        else if (macd < 0 && lastMacd > 0) macdChangeIndex = index;
      });
      stock.macd_5_last_cross = moment
        .unix(macd_5.t[macdChangeIndex])
        .toISOString();

      macdChangeIndex = -1;
      macd_D.macdHist.forEach((macd, index) => {
        if (index == 0) return;
        const lastMacd = macd_D.macdHist[index - 1];
        if (macd > 0 && lastMacd < 0) macdChangeIndex = index;
        else if (macd < 0 && lastMacd > 0) macdChangeIndex = index;
      });
      stock.macd_d_last_cross = moment
        .unix(macd_D.t[macdChangeIndex])
        .toISOString();

      if (stock.price_delta_5 > 0.4)
        await slack.chat.postMessage({
          text: `${stock.name} increased ${stock.price_delta_5} in the last 5 minutes`,
          channel: slack.generalChannelId,
        });

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
