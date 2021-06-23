const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const util = require('util');
const moment = require("moment");

const knex = Knex();

async function Run(){
    const stocks = await knex.table("stocks").select();
    const stockMap={}
    stocks.forEach(item=>{
        stockMap[item.name]=item;
    })
 
    const prices = (await Alpaca.data("stocks/snapshots").query({symbols: stocks.map( item=>item.name ).join(",") })).body;

    let index =0;


    while(index<stocks.length){
        const stock = stocks[index]
        const price = prices[stock.name];
        const createdAt = moment(price.latestTrade.t).toISOString();

        await knex.table("prices1").insert({ stock_id_created_at: `${stock.id}_${createdAt}`, created_at: createdAt ,stock_id: stock.id, price: price.latestTrade.p }).onConflict("stock_id_created_at").merge()
        index++;
    }

    //const stockCandles = util.promisify(FinHub.stockCandles).bind(FinHub)
    //const data = await stockCandles("AAPL", "1", moment().add(-2,"hours").unix(), moment().unix(),{});
    //console.log(data);

    return true;
}
module.exports=Run;

if(process.env.LOCAL) Run();