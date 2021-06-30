const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
let { delay, priceDiff, average, isPreMarket } = require("../helpers/utils");
const Slack = require("../helpers/slack");
isPreMarket = isPreMarket();

async function Run() {
  const knex = await Knex();

  process.on("exit", async (code) => {
    console.log("disconnecting");
    await knex.destroy();
  });

  const stocks = await knex.table("stocks").select();
  const stockMap = {};
  stocks.forEach((item) => {
    stockMap[item.name] = item;
  });

  const prices = (
    await Alpaca.data("stocks/snapshots").query({
      symbols: stocks.map((item) => item.name).join(","),
    })
  ).body;

  let index = 0;

  while (index < stocks.length) {
    const stock = stocks[index];
    const price = prices[stock.name];

    const candles = (
      await Alpaca.data(`stocks/${stock.name}/bars`).query({
        timeframe: "1Min",
        start: isPreMarket
          ? moment()
              .utcOffset(-4)
              .hour(4)
              .minute(0)
              .format("YYYY-MM-DDTHH:mm:ss.00Z")
          : moment()
              .utcOffset(-4)
              .hour(9)
              .minute(30)
              .format("YYYY-MM-DDTHH:mm:ss.00Z"),
        end: moment().format("YYYY-MM-DDTHH:mm:ss.00Z"),
      })
    ).body.bars;

    const ratio = 5;
    let prices5m = candles.filter(function (value, index, ar) {
      return index % ratio == 0;
    });

    let roc_5 = average(candles.slice(-15).map((item) => item.c));

    let delta1 = priceDiff(price.minuteBar.o, price.latestTrade.p);

    const p_2 = candles[candles.length - 2];
    const p_3 = candles[candles.length - 3];
    const p_4 = candles[candles.length - 4];
    const p_5 = candles[candles.length - 5];

    let delta5 = p_5 && priceDiff(p_5.o, p_5.h);
    let delta4 = p_4 && priceDiff(p_4.o, p_4.h);
    let delta3 = p_3 && priceDiff(p_3.o, p_3.h);
    let delta2 = p_2 && priceDiff(p_2.o, p_2.h);

    let delta30 =
      candles.length > 30 &&
      priceDiff(candles[candles.length - 30].o, price.latestTrade.p);

    let delta90 =
      candles.length > 90 &&
      priceDiff(candles[candles.length - 90].o, price.latestTrade.p);

    if (delta1 > 0.4) {
      const slack = await Slack();
      await slack.chat.postMessage({
        text: `${stock.name} increased ${delta1} % in the last minute. So far today ${stock.price_delta_d}`,
        channel: slack.channelsMap["stocks"].id,
      });
    }

    await knex
      .table("stocks")
      .update({
        price_delta_1: isPreMarket || !delta1 ? 0 : delta1,
        price_delta_5: isPreMarket || !delta5 ? 0 : delta5,
        price_delta_30: isPreMarket || !delta30 ? 0 : delta30,
        price_delta_90: isPreMarket || !delta90 ? 0 : delta90,
        today_prices: prices5m.map((item) => item.c).join(","),
      })
      .where("id", stock.id);

    index++;
  }

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
