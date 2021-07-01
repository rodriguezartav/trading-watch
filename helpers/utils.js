const moment = require("moment");

function delay(t, val) {
  return new Promise(function (resolve) {
    if (t <= 0) {
      resolve(val);
    } else {
      setTimeout(resolve.bind(null, val), t);
    }
  });
}

function priceDiff(b, a) {
  let deltaD = 0;

  if (b == null) b = 0;
  if (a == null) a = 0;

  if (a < b) deltaD = ((b - a) / b) * -100;
  else deltaD = ((a - b) / b) * 100;
  return parseInt(deltaD * 100) / 100;
}

function average(array) {
  return array.reduce(function (avg, value, _, { length }) {
    return avg + value / length;
  }, 0);
}

function isPreMarket() {
  const toOpen = moment().diff(
    moment().utcOffset(-4).hour(9).minute(30),
    "minutes"
  );
  if (toOpen < 0) return true;
  else return false;
}

function isBetweenExtendedMarketHours() {
  return (
    moment().isAfter(moment().utcOffset(-4).hour(4).minute(5)) &&
    moment().isBefore(moment().utcOffset(-4).hour(20).minute(5))
  );
}

function crossIndex(array) {
  let macdChangeIndex = -1;
  let index = array.length - 1;
  while (index > -1 || macdChangeIndex > -1) {
    if (index == array.length - 1) {
      index--;
    } else {
      const macd = array[index];
      const lastMacd = array[index - 1];
      if (macd > 0 && lastMacd < 0) macdChangeIndex = index;
      else if (macd < 0 && lastMacd > 0) macdChangeIndex = index;
      index--;
    }
  }
  return macdChangeIndex;
}

function crossRSIIndex(array) {
  let macdChangeIndex = -1;
  let index = array.length - 1;
  while (index > -1 || macdChangeIndex > -1) {
    if (index == array.length - 1) {
      index--;
    } else {
      const macd = array[index];
      const lastMacd = array[index - 1];

      if (macd < 70 && lastMacd > 70) macdChangeIndex = index;
      else if (macd > 30 && lastMacd < 30) macdChangeIndex = index;
      index--;
    }
  }
  return macdChangeIndex;
}

module.exports = {
  delay,
  crossRSIIndex,
  crossIndex,
  priceDiff,
  average,
  isPreMarket,
  isBetweenExtendedMarketHours,
};
