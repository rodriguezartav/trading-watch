
const Knex = require("../helpers/knex");
const FinHub = require("../helpers/finhub");
const Alpaca = require("../helpers/alpaca");
const moment = require("moment");

const knex = Knex();

async function Run(){
    const stocks = await knex.table("stocks").select();
    const stockMap={}
    stocks.forEach(item=>{
        stockMap[item.name]=item;
    })
 
    const data = await FinHub("technicalIndicator","AAPL", "5", moment().add(-1,"days").unix(), moment().unix(),"macd",{});

    console.log(data.macdHist);

    return true;
}
module.exports=Run;

if(process.env.LOCAL) Run();