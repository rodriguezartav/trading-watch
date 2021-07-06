const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
let { priceDiff, average, isPreMarket } = require("../helpers/utils");
const Proposals = require("../helpers/proposals");

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

    let candles5M = await FinHub.Candles(
      stock.name,
      "5",
      isPreMarket
        ? moment().utcOffset(-4).hour(4).minute(0).unix()
        : moment().utcOffset(-4).hour(9).minute(30).unix(),
      isPreMarket
        ? moment().utcOffset(-4).hour(16).minute(00).unix()
        : moment().unix()
    );

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
        end: isPreMarket
          ? moment()
              .utcOffset(-4)
              .hour(16)
              .minute(00)
              .format("YYYY-MM-DDTHH:mm:ss.00Z")
          : moment().format("YYYY-MM-DDTHH:mm:ss.00Z"),
      })
    ).body.bars;

    if (!candles5M.c) candles5M = { c: [] };

    let prices5m = candles5M.c;

    let roc_5 = average(candles5M.c.slice(-15).map((item) => item.c));

    let delta1 =
      candles.length == 0
        ? 0
        : priceDiff(price.minuteBar.o, price.latestTrade.p);

    const p_1 = candles[candles.length - 1];
    const p_2 = candles[candles.length - 2];
    const p_3 = candles[candles.length - 3];
    const p_4 = candles[candles.length - 4];
    const p_5 = candles[candles.length - 5];

    let delta5 = p_5 && priceDiff(p_5.o, p_5.h);
    let delta4 = p_4 && p_5 && priceDiff(p_5.c, p_4.h);
    let delta3 = p_3 && p_4 && priceDiff(p_4.o, p_3.h);
    let delta2 = p_2 && p_3 && priceDiff(p_3.o, p_2.h);
    let delta1High = p_1 && p_2 && priceDiff(p_2.o, p_1.h);

    let minute_prices_deltas = JSON.stringify([
      delta1High || 0,
      delta2 || 0,
      delta3 || 0,
      delta4 || 0,
      delta5 || 0,
    ]);

    let delta30 =
      candles.length > 30 &&
      priceDiff(candles[candles.length - 30].o, price.latestTrade.p);

    let delta90 =
      candles.length > 90 &&
      priceDiff(candles[candles.length - 90].o, price.latestTrade.p);

    await knex
      .table("stocks")
      .update({
        roc_5,
        price_today_open: prices5m[0] || 0,
        price_delta_1: delta1 || 0,
        price_delta_5: delta5 || 0,
        price_delta_30: delta30 || 0,
        price_delta_90: delta90 || 0,
        today_prices: prices5m.join(","),
        minute_prices_deltas: minute_prices_deltas,
      })
      .where("id", stock.id);

    index++;
  }

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
