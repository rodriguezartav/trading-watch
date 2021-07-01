require("dotenv").config();
const moment = require("moment");
const Knex = require("../helpers/knex");
const { priceDiff } = require("../helpers/utils");

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
  //uncaughtException;
  //unhandledRejection;
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

setInterval(async () => {
  await loadStocks();
}, 30000);

module.exports = function Sockets(server) {
  //

  var wss = new WebSocketServer({ server: server });
  console.log("websocket server created");

  wss.on("connection", function (ws) {
    console.log("websocket connection open");

    const id = setInterval(() => {
      trades.time = moment().utcOffset(-4).toISOString();
      ws.send(
        JSON.stringify({ stocks: trades, orders: orders }),
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
    //});
  });

  socket.onStockTrade((trade) => {
    const lastTradeTime = tradesTimes[trade.Symbol];
    if (!lastTradeTime) return;
    const diff = Math.abs(
      lastTradeTime.diff(moment(trade.Timestamp), "second")
    );
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
    }
  });

  loadStocks().then(() => {
    socket.connect();
  });
}

if (process.env.LOCAL) Run();
