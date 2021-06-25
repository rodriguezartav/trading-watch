require("dotenv").config();
const moment = require("moment");
const Knex = require("../helpers/knex");
const { priceDiff } = require("../helpers/utils");

var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require("express");
var app = express();
var port = process.env.PORT || 5000;

const Alpaca = require("@alpacahq/alpaca-trade-api");
const API_KEY = process.env.APCA_API_KEY_ID;
const API_SECRET = process.env.APCA_API_SECRET_KEY;

const alpaca = new Alpaca({
  keyId: API_KEY,
  secretKey: API_SECRET,
  feed: "sip",
});

async function Run() {
  const knex = Knex();

  process.on("exit", async (code) => {
    console.log("disconnecting");
    await knex.destroy();
    //uncaughtException;
    //unhandledRejection;
  });

  const socket = alpaca.data_stream_v2;
  let stocks = await knex.table("stocks").select();
  let stockMap = {};

  let trades = {};
  let tradesTimes = {};
  stocks.forEach((item) => {
    stockMap[item.name] = item;
    tradesTimes[item.name] = moment();
  });

  setInterval(async () => {
    try {
      stocks = await knex.table("stocks").select();
      stocks.forEach((item) => {
        stockMap[item.name] = item;
        tradesTimes[item.name] = tradesTimes[item.name] || moment();
      });
    } catch (e) {
      console.error(e);
    }
  }, 30000);

  socket.onConnect(function () {
    console.log("Connected");
    const names = stocks.map((item) => item.name);

    //stocks.forEach((item) => {
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

  socket.connect();

  app.use(express.static(__dirname + "/"));

  var server = http.createServer(app);
  server.listen(port);
  //
  console.log("http server listening on %d", port);

  var wss = new WebSocketServer({ server: server });
  console.log("websocket server created");

  wss.on("connection", function (ws) {
    console.log("websocket connection open");

    const id = setInterval(() => {
      trades.time = moment().utcOffset(-4).toISOString();
      ws.send(JSON.stringify(trades), function () {});
    }, 1000);

    ws.on("close", function () {
      console.log("websocket connection close");
      clearInterval(id);
    });
  });
}

Run();
