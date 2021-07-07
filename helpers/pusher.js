const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "1231299",
  key: "818630906bc836d5ce81",
  secret: "da2ae05702ef08b42cfc",
  cluster: "mt1",
  useTLS: true,
});

module.exports = pusher;
