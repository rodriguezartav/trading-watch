const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
const { delay, priceDiff, average, isPreMarket } = require("../helpers/utils");
const Slack = require("../helpers/slack");

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
    stock.price = price.latestTrade.p;
  }

  await knex
    .table("stocks")
    .insert({
      id: stock.id,
      price: price.latestTrade.p,
    })
    .onConflict("id")
    .merge();

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
