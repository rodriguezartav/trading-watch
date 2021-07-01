const Knex = require("../helpers/knex");

module.exports = {
  createOrder: async function (stock, type, reason) {
    const knex = await Knex();

    const orders = await knex
      .table("orders")
      .select()
      .where("stock_id", stock.id)
      .where("status", "pending")

      .where("type", type)

      .first();
  },
  executeOrder: async function () {
    const knex = await Knex();
  },
};
