require("dotenv").config();
const moment = require("moment");
const { isBetweenExtendedMarketHours } = require("../helpers/utils");
const Knex = require("../helpers/knex");

module.exports = async function Run() {
  const pendingOrders = await knex.table("pending_orders").select();
  const orders = await knex.table("orders").select();
};
