//
// This file creates Jobs - it's called from the main server App.
//

require("dotenv").config();
const moment = require("moment");

const Knex = require("../helpers/knex");

setInterval(async () => {
  try {
    const knex = Knex();

    let schedules = await knex.table("schedules").select();
    for (let index = 0; index < schedules.length; index++) {
      const schedule = schedules[index];

      const existingJobs = await knex
        .table("jobs")
        .whereIn("status", ["pending", "working"])
        .where("schedule_id", schedule.id);

      if (
        schedule.start_at &&
        moment().unix() < moment(schedule.start_at).unix()
      ) {
        //Ignore because of start at has not yet occured
      } else {
        if (
          existingJobs.length == 0 &&
          moment(schedule.last_run || "1970-01-01")
            .add(schedule.period_in_minutes, "minutes")
            .unix() < moment().unix()
        ) {
          const ids = await knex
            .table("jobs")
            .insert({
              status: "pending",
              schedule_id: schedule.id,
              script_id: schedule.script_id,
            })
            .returning("id");

          console.log(
            `API_EVENT:::JOB_CREATOR:::INSERT_JOB:::${JSON.stringify({
              job_id: ids[0],
              schedule_id: schedule.id,
              script_id: schedule.script_id,
              time: moment().valueOf(),
            })}`
          );
        }
      }
    }
  } catch (e) {
    console.error(`CRITICAL_ERROR:::${e.message}:::${e.stack}`);
    console.error(e);
    throw e;
  }
}, 1500);

setInterval(async () => {
  try {
    if (moment().isBefore(moment().utcOffset(-4).hour(20).minute(0))) {
      const knex = Knex();

      const jobs = await knex
        .table("jobs")
        .select("jobs.*", "scripts.name as script_name")
        .join("scripts", "scripts.id", "jobs.script_id")
        .whereIn("status", ["working"]);

      const lateJobs = jobs.filter((item) => {
        if (Math.abs(moment(item.created_at).diff(moment(), "minutes")) > 30)
          return true;
        else return false;
      });

      if (lateJobs.length > 0) {
        const slack = await Slack();

        await slack.chat.postMessage({
          text: `Some jobs seem to be stuck. (${lateJobs
            .map(
              (item) =>
                `${item.script_name} ${moment(item.created_at).fromNow()}`
            )
            .join("\n")} `,
          channel: slack.generalChannelId,
        });
      }
    }
  } catch (e) {
    console.error("CRITICAL_ERROR");
    console.error(e);
    throw e;
  }
}, 60000 * 5);
