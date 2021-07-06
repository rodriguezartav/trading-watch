var express = require("express");
var router = express.Router();
const Alpaca = require("../../helpers/alpaca");

router.get("/", async function (req, res) {
  const { body } = await Alpaca.order();
  return res.send(body);
});

router.get("/:symbol", async function (req, res) {
  const { body } = await Alpaca.position(req.params.symbol);
  return res.send(body);
});

module.exports = router;
