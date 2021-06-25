//
// This file creates Jobs - it's called from the main server App.
//

require("dotenv").config();
const moment = require("moment");
const { isBetweenExtendedMarketHours } = require("../helpers/utils");
const Knex = require("../helpers/knex");
const Heroku = require("heroku-client");
const heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });

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

          await heroku.post("/apps/trading-watch/dynos", {
            body: {
              command: `node ./workers/_runner.js job_id=${ids[0]}`,
              env: {
                COLUMNS: "80",
                LINES: "24",
                SCRIPT_OPTIONS: JSON.stringify(schedule.script_options || {}),
                TIME_TO_LIVE: schedule.time_to_live || 0,
                JOB_ID: ids[0],
                SCRIPT: script.location,
              },
              force_no_tty: null,
              size: "Hobby.",
              type: "run",
              time_to_live: schedule.time_to_live || 60 * 3,
            },
          });

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
}, 1000);

setInterval(async () => {
  try {
    const knex = Knex();

    const jobs = await knex
      .table("jobs")
      .select("jobs.*", "scripts.name as script_name")
      .join("scripts", "scripts.id", "jobs.script_id")
      .whereIn("status", ["pending", "working"]);

    const lateJobs = jobs.filter((job) => {
      if (
        moment()
          .add(job.period_in_minutes * 2, "minutes")
          .isAfter(moment())
      )
        return true;
      else return false;
    });

    if (lateJobs.length > 0) {
      const slack = await Slack();

      await Promise.all(
        lateJobs.map((item) => knex.table("jobs").delete().where("id", item.id))
      );

      await slack.chat.postMessage({
        text: `Some jobs seem to be stuck. (${lateJobs
          .map(
            (item) => `${item.script_name} ${moment(item.created_at).fromNow()}`
          )
          .join("\n")} `,
        channel: slack.generalChannelId,
      });
    }
  } catch (e) {
    console.error("CRITICAL_ERROR");
    console.error(e);
    throw e;
  }
}, 500);
