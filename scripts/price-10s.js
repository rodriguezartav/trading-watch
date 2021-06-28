const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require("util");
const moment = require("moment");
const { delay, priceDiff, average, isPreMarket } = require("../helpers/utils");

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

  const prices = (
    await Alpaca.data("stocks/snapshots").query({
      symbols: stocks.map((item) => item.name).join(","),
    })
  ).body;

  let index = 0;

  const promises = [];
  while (index < stocks.length) {
    const stock = stocks[index];
    const price = prices[stock.name];
    stock.price = price.latestTrade.p;
    let firstTrade = stock.today_prices.split(",")[0];
    if (firstTrade) firstTrade = parseFloat(firstTrade);

    promises.push(
      knex
        .table("stocks")
        .update({
          price_today_open:
            isPreMarket() && firstTrade ? firstTrade : price.dailyBar.o,
          last_price_update_at: moment().toISOString(),
          price: parseInt(price.latestTrade.p * 100) / 100,
          price_delta_d: firstTrade
            ? priceDiff(
                isPreMarket() ? firstTrade : price.dailyBar.o,
                price.latestTrade.p
              )
            : 0,
        })
        .where("id", stock.id)
    );

    index++;
  }

  await Promise.all(promises);

  return true;
}
module.exports = Run;

if (process.env.LOCAL) Run();
