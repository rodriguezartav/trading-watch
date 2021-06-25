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
  const slack = await Slack();

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
    const createdAt = moment(price.latestTrade.t).toISOString();

    const candles = (
      await Alpaca.data(`stocks/${stock.name}/bars`).query({
        timeframe: "1Min",
        start: moment()
          .utcOffset(-4)
          .hour(9)
          .minute(30)
          .format("YYYY-MM-DDTHH:mm:ss.00Z"),
        end: moment().format("YYYY-MM-DDTHH:mm:ss.00Z"),
      })
    ).body.bars;

    let roc_5 = average(candles.slice(-15).map((item) => item.c));
    let deltaD = priceDiff(price.dailyBar.o, price.latestTrade.p);
    let delta1 = priceDiff(price.minuteBar.o, price.latestTrade.p);
    let delta2 = priceDiff(
      candles[candles.length - 2].o,
      candles[candles.length - 1].o
    );
    let delta3 = priceDiff(
      candles[candles.length - 3].o,
      candles[candles.length - 2].o
    );
    let delta4 = priceDiff(
      candles[candles.length - 4].o,
      candles[candles.length - 3].o
    );

    if (delta1 > 0.4 || (delta1 > delta2 && delta2 > delta3 && delta3 > delta4))
      await slack.chat.postMessage({
        text: `${stock.name} increased ${delta1} % in the last 1 minute. [${delta2},${delta3},${delta4}]`,
        channel: slack.generalChannelId,
      });

    const ratio = 5;
    const prices5m = candles.filter(function (value, index, ar) {
      return index % ratio == 0;
    });

    await knex
      .table("stocks")
      .update({
        roc_5: isPreMarket ? 0 : roc_5,
        price_delta_1: isPreMarket ? 0 : delta1,
        price_delta_d: isPreMarket ? 0 : deltaD,
        today_prices: prices5m.map((item) => item.c).join(","),
      })
      .where("id", stock.id);

    index++;
  }

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
