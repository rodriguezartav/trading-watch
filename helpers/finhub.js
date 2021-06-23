require("dotenv").config();
const util = require('util');

const Finnhub = require('finnhub');
 
const api_key = Finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.FINHUB_API // Replace this
const finnHubClient = new Finnhub.DefaultApi()


function Run(fnName,...params){
    return util.promisify(finnHubClient[fnName]).apply(finnHubClient,params);
}


module.exports = Run;