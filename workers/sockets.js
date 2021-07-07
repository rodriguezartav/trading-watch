require("dotenv").config();
const moment = require("moment");
const Knex = require("../helpers/knex");
const { priceDiff } = require("../helpers/utils");
const Pusher = require("../helpers/pusher");

const Proposals = require("../helpers/proposals");

const Alpaca = require("@alpacahq/alpaca-trade-api");
const Slack = require("../helpers/slack");
const API_KEY = process.env.APCA_API_KEY_ID;
const API_SECRET = process.env.APCA_API_SECRET_KEY;

const alpaca = new Alpaca({
  keyId: API_KEY,
  secretKey: API_SECRET,
  feed: "sip",
});

const knex = Knex();
let trades = {};
let tradesTimes = {};
let stocks = [];
let stockMap = {};
let proposals = [];
let socket;
let socketConnected = false;
let slack;

async function loadStocks() {
  try {
    let hasNewStocks = false;

    stocks = await knex.table("stocks").select();
    stocks.forEach((item) => {
      if (!stockMap[item.name]) hasNewStocks = true;
      stockMap[item.name] = item;
      tradesTimes[item.name] = tradesTimes[item.name] || moment();
    });

    if (hasNewStocks && socketConnected) registerStocks(socket, stocks);
  } catch (e) {
    console.error(e);
  }
}

async function loadProposals() {
  try {
    proposals = await knex.table("proposals").select();
    proposals.forEach((item) => {
      if (!stockMap[item.name]) hasNewStocks = true;
      stockMap[item.name] = item;
      tradesTimes[item.name] = tradesTimes[item.name] || moment();
    });

    if (hasNewStocks && socketConnected) registerStocks(socket, stocks);
  } catch (e) {
    console.error(e);
  }
}

setInterval(async () => {
  await loadStocks();
}, 120000);

function registerStocks(socket, stocks) {
  console.log("Alpaca Socket Connected");
  const names = stocks.map((item) => item.name);
  socket.subscribeForTrades(names);
}

module.exports = function Sockets(server) {
  Run();
};

function Run() {
  socket = alpaca.data_stream_v2;

  socket.onError(function (e) {
    console.log(e);
  });

  socket.onConnect(function () {
    socketConnected = true;
    registerStocks(socket, stocks);
  });

  socket.onStockTrade(async (trade) => {
    try {
      const stock = stockMap[trade.Symbol];

      const lastTradeTime =
        tradesTimes[trade.Symbol] || moment().add(-1, "day");
      const diff = Math.abs(
        lastTradeTime.diff(moment(trade.Timestamp), "second")
      );

      trades[trade.Symbol] = {
        name: trade.Symbol,
        id: stock.id,
        last_price_update_at: moment(trade.Timestamp).toISOString(),
        price: parseInt(trade.Price * 100) / 100,
        price_delta_d: priceDiff(
          stockMap[trade.Symbol].price_today_open,
          trade.Price
        ),
      };

      if (diff >= 1) {
        tradesTimes[trade.Symbol] = moment(trade.Timestamp);
        Pusher.trigger("my-channel", "my-event", {
          message: JSON.stringify({
            time: moment().utcOffset(-4).toISOString(),
            trade: trades[trade.Symbol],
          }),
        });

        const minute_prices_deltas = JSON.parse(stock.minute_prices_deltas);
        const p1 = minute_prices_deltas[0];
        const p2 = minute_prices_deltas[1];

        if (p1 && p2) {
          if (Math.abs(p1) > 0.4 && Math.abs(p2) > 0.4) {
            if (!slack) slack = await Slack();

            /*
            await slack.chat.postMessage({
              text: `Consider ${p1 > 0 ? "LONG" : "SHORT"} ${stock.name} at ${
                parseInt(trade.Price * 100) / 100
              }`,

              channel: slack.channelsMap["stocks"].id,
            });
            */
          }
        }

        await knex
          .table("stocks")
          .update({
            last_price_update_at: moment(trade.Timestamp).toISOString(),
            price: parseInt(trade.Price * 100) / 100,
            price_delta_d: priceDiff(
              stockMap[trade.Symbol].price_today_open,
              trade.Price
            ),
          })
          .where("id", stock.id);
      }
    } catch (e) {
      console.log("NOTICE");
      console.log(e);
    }
  });

  loadStocks()
    .then(() => {
      socket.connect();
    })
    .catch((e) => {
      console.log(e);
    });
}

if (process.env.LOCAL) Run();
