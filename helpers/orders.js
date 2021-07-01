const Knex = require("./knex");
const Slack = require("./slack");

module.exports = {
  createOrder: async function (stock, type, price, reason, description) {
    const knex = await Knex();

    const order = await knex
      .table("orders")
      .select()
      .where("stock_id", stock.id)
      .where("status", "pending")
      .where("type", type)
      .first();

    if (type == "SHORT" && !order) return true;

    if (!order) {
      await knex.table("orders").insert({
        stock_id: stock.id,
        reason: reason,
        status: "pending",
        log: { try: 1 },
        description: description,
        type: type,
        price_limit: price,
        external_id: stock.name + "-" + parseInt(Math.random() * 100000),
      });

      const slack = await Slack();
      await slack.chat.postMessage({
        text: description,
        channel: slack.channelsMap["stocks"].id,
      });
    } else
      await knex
        .table("orders")
        .update({
          id: order.id,
          reason: reason,
          description: description,
          log: { try: order.log.try + 1 },
          type: type,
          price_limit: price,
        })
        .where("id", order.id);
  },
  executeOrder: async function () {
    const knex = await Knex();
  },
};
