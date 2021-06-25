//
// This file is called from Job Worker - it run as a fork to keep jobWorker from crasing.
//

require("dotenv").config();
const moment = require("moment");
const { isBetweenExtendedMarketHours } = require("../helpers/utils");
const Heroku = require("heroku-client");
const heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });
const Knex = require("../helpers/knex");

async function Scheduler() {
  try {
    var knex = await Knex();

    let jobs = await knex
      .table("jobs")
      .select(
        "jobs.*",
        "scripts.name as script_name",
        "scripts.location as script_location",
        "schedules.time_to_live"
      )
      .join("scripts", "scripts.id", "jobs.script_id")
      .join("schedules", "schedules.id", "jobs.schedule_id")
      .whereNotNull("scripts.location")
      .where("status", "pending");

    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index];
      try {
        console.log(
          `API_EVENT:::JOB_RUNNER:::START:::${JSON.stringify({
            script_location: job.script_location,
            job_id: job.id,
            time: moment().valueOf(),
          })}`
        );

        console.log(
          `API_EVENT:::HEROKU_RUNNER:::START:::${JSON.stringify({
            job_id: job.id,
            time: moment().valueOf(),
            script: job.script_location,
          })}`
        );

        await heroku.post("/apps/trading-watch/dynos", {
          body: {
            command: `node ./workers/_runner.js job_id=${job.id}`,
            env: {
              COLUMNS: "80",
              LINES: "24",
              SCRIPT_OPTIONS: JSON.stringify(job.script_options || {}),
              TIME_TO_LIVE: job.time_to_live || 0,
              JOB_ID: job.id,
              SCRIPT: job.script_location,
            },
            force_no_tty: null,
            size: "Hobby.",
            type: "run",
            time_to_live: job.time_to_live || 60 * 90,
          },
        });

        await knex
          .table("jobs")
          .update({ status: "working" })
          .where("id", job.id);

        console.log(
          `API_EVENT:::JOB_RUNNER:::ASYNC:::END:::${JSON.stringify({
            script_location: job.script_location,
            job_id: job.id,
            time: moment().valueOf(),
          })}`
        );
      } catch (e) {
        console.log(
          `API_EVENT:::JOB_RUNNER:::ERROR:::${JSON.stringify({
            job_id: job.id,
            script_location: job.script_location,
            error: { message: e.message, stack: e.stack },
            time: moment().valueOf(),
          })}`
        );

        console.error(e);
      }
    }
  } catch (e) {
    console.log(
      `API_EVENT:::JOB_RUNNER:::CRITICAL_ERROR:::${JSON.stringify({
        error: { message: e.message, stack: e.stack },
        time: moment().valueOf(),
      })}`
    );

    console.error(e);
  }
}

(async function () {
  try {
    setInterval(async () => {
      try {
        if (isBetweenExtendedMarketHours()) await Scheduler();
      } catch (e) {
        console.log(e);
        console.log("PROCESS_RUNNER ERROR");
      }
    }, 3000);
  } catch (e) {
    console.log("PROCESS_RUNNER CRITICAL_ERROR");
    console.error(e);
  }
})();

module.exports = Scheduler;
