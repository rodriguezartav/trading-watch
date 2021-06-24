const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
const { delay, priceDiff, average, isPreMarket } = require("../helpers/utils");

const knex = Knex();

async function Run() {
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

    const candles = await FinHub(
      "stockCandles",
      stock.name,
      "5",
      moment().utcOffset(-4).hour(9).minute(30).unix(),
      moment().unix(),
      {}
    );

    const oldPrices = await knex
      .table("prices_1")
      .select("value", "is_5_min")
      .orderBy("created_at", "desc")
      .where("id", stock.id)
      .limit(5);

    let has_5_min = false;
    let priceExists = false;
    oldPrices.map((item, index) => {
      if (moment(item.created_at).diff(createdAt, "seconds") < 10)
        priceExists = true;
      if (item.is_5_min) has_5_min = true;

      if (index == 0) return;
      return priceDiff(oldPrices[index - 1], item.value);
    });

    let roc_5 = average(oldPrices);

    let deltaD = priceDiff(price.dailyBar.o, price.latestTrade.p);
    let delta1 = priceDiff(
      oldPrices[oldPrices.length].price,
      price.latestTrade.p
    );

    if (delta1 > 0.4)
      await slack.chat.postMessage({
        text: `${stock.name} increased ${stock.delta1} in the last 1 minute`,
        channel: slack.generalChannelId,
      });

    if (!priceExists) {
      try {
        await knex.table("prices_1").insert({
          stock_id_created_at: `${stock.id}_${createdAt}`,
          created_at: createdAt,
          stock_id: stock.id,
          value: price.latestTrade.p,
          is_5_min: !has_5_min,
        });
      } catch (e) {}
    }
    await knex
      .table("stocks")
      .update({
        roc_5: isPreMarket ? 0 : roc_5,
        price_delta_1: isPreMarket ? 0 : delta1,
        price: price.latestTrade.p,
        price_delta_d: isPreMarket ? 0 : deltaD,
        today_prices: candles.c.join(","),
      })
      .where("id", stock.id);

    index++;
  }

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
