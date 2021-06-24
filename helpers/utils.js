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

  if (a < b) deltaD = ((b - a) / b) * -100;
  else deltaD = ((a - b) / b) * 100;
  return parseInt(deltaD * 100) / 100;
}

function average(array) {
  return array.reduce(function (avg, value, _, { length }) {
    return avg + value / length;
  }, 0);
}

module.exports = {
  delay,
  priceDiff,
  average,
};
