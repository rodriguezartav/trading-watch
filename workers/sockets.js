require("dotenv").config();
const moment = require("moment");
const Knex = require("../helpers/knex");
const { priceDiff } = require("../helpers/utils");

const Orders = require("../helpers/orders");

var WebSocketServer = require("ws").Server;

const Alpaca = require("@alpacahq/alpaca-trade-api");
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
let orders = [];

process.on("exit", async (code) => {
  console.log("disconnecting");
  await knex.destroy();
});

async function loadStocks() {
  try {
    stocks = await knex.table("stocks").select();
    stocks.forEach((item) => {
      stockMap[item.name] = item;
      tradesTimes[item.name] = tradesTimes[item.name] || moment();
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadOrders() {
  try {
    orders = await knex.table("orders").select();
  } catch (e) {
    console.error(e);
  }
}

setInterval(async () => {
  await loadStocks();
}, 10000);

setInterval(async () => {
  await loadOrders();
}, 10000);

module.exports = function Sockets(server) {
  //

  var wss = new WebSocketServer({ server: server });
  console.log("websocket server created");

  wss.on("connection", function (ws) {
    console.log("websocket connection open");

    const id = setInterval(() => {
      ws.send(
        JSON.stringify({
          time: moment().utcOffset(-4).toISOString(),
          stocks: trades,
          orders: orders,
        }),
        function () {}
      );
    }, 1000);

    ws.on("close", function () {
      console.log("websocket connection close");
      clearInterval(id);
    });
  });

  Run();
};

function Run() {
  const socket = alpaca.data_stream_v2;

  socket.onConnect(function () {
    console.log("Connected");
    const names = stocks.map((item) => item.name);

    socket.subscribeForTrades(names);
  });

  socket.onStockTrade(async (trade) => {
    const stock = stockMap[trade.Symbol];

    const lastTradeTime = tradesTimes[trade.Symbol];
    const diff = Math.abs(
      lastTradeTime.diff(moment(trade.Timestamp), "second")
    );

    const todayPrices = stock.today_prices.split(",");
    const minutePrice = todayPrices[todayPrices.length - 1];
    let delta1 = priceDiff(minutePrice, trade.Price);
    if (Math.abs(delta1) > 0.4) {
      await Orders.create(
        stock,
        delta1 > 0 ? "LONG" : "SHORT",
        trade.Price,
        `Price ${delta1}%`,
        `${stock.name} ${delta1 > 0 ? "LONG" : "SHORT"} in 1 minute`
      );
    }
    if (diff > 1) {
      trades[trade.Symbol] = {
        ...stockMap[trade.Symbol],
        price: parseInt(trade.Price * 100) / 100,
        price_delta_d: priceDiff(
          stockMap[trade.Symbol].price_today_open,
          trade.Price
        ),
      };
      tradesTimes[trade.Symbol] = moment(trade.Timestamp);

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
  });

  loadStocks().then(() => {
    socket.connect();
  });
}

if (process.env.LOCAL) Run();
