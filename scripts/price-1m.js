const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
const { delay, priceDiff, average } = require("../helpers/utils");

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

    let deltaD = 0;

    const oldPrices = await knex
      .table("prices_1")
      .select("value", "is_5_min")
      .order("created_at", "desc")
      .where("id", stock.id)
      .limit(5);

    let has_5_min = false;
    oldPrices.map((item, index) => {
      if (item.is_5_min) has_5_min = true;

      if (index == 0) return;
      return priceDiff(oldPrices[index - 1], item.value);
    });

    let roc_5 = average(oldPrices);

    let deltaD = priceDiff(price.dailyBar.o, price.latestTrade.p);
    let delta1 = priceDiff(price.minuteBar.o, price.minuteBar.c);

    await knex
      .table("prices_1")
      .insert({
        stock_id_created_at: `${stock.id}_${createdAt}`,
        created_at: createdAt,
        stock_id: stock.id,
        value: price.latestTrade.p,
        is_5_min: !has_5_min,
      })
      .onConflict("stock_id_created_at")
      .merge();
    await knex
      .table("stocks")
      .update({
        roc_5: roc_5,
        price_delta_1: delta1,
        price: price.latestTrade.p,
        price_delta_d: deltaD,
      })
      .where("id", stock.id);
    index++;
  }

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
