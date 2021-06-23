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

    //const oldPrices = await knex.table("prices_1").distinct("stock_id").select("value").order("created_at","desc");

    let index =0;


    while(index<stocks.length){
        const stock = stocks[index]
        const price = prices[stock.name];
        const createdAt = moment(price.latestTrade.t).toISOString();

        await knex.table("prices_1").insert({ stock_id_created_at: `${stock.id}_${createdAt}`, created_at: createdAt ,stock_id: stock.id, value: price.latestTrade.p }).onConflict("stock_id_created_at").merge()
        await knex.table("stocks").update({ price: price.latestTrade.p }).where("id",stock.id);
        index++;
    }
 
    return true;
}
module.exports=Run;

if(process.env.LOCAL) Run();
