var express = require("express");
var router = express.Router();
const Knex = require("../../helpers/knex");
const moment = require("moment");
const superagent = require("superagent");
const Slack = require("../../helpers/slack");

const knex = Knex();

router.post("/", async function (req, res, next) {
  const { exit_status, command, name } = req.body.data;
  const action = req.body.data.action;
  const jobId = parseInt(command.split("job_id=")[1]);

  console.log(action, exit_status, jobId, name);

  const slack = await Slack();

  if (!jobId || exit_status == null) return res.json({});
  const job = await knex
    .table("jobs")
    .select("jobs.*", "scripts.location as script_location")
    .join("scripts", "scripts.id", "jobs.script_id")
    .where("jobs.id", jobId)
    .first();

  console.log(
    `API_EVENT:::HEROKU_RUNNER:::END:::${JSON.stringify({
      job_id: jobId,
      time: moment().valueOf(),
      herokuScript_name: name,
    })}`
  );

  if (job) {
    await knex.table("jobs").delete().where("id", jobId);

    await knex
      .table("executions")
      .insert({ schedule_id: job.schedule_id, result: exit_status });

    await knex
      .table("schedules")
      .update({ last_run: moment() })
      .where("id", job.schedule_id);

    if (exit_status == 1) {
      console.log(
        `API_EVENT:::HEROKU_RUNNER:::END:::${JSON.stringify({
          job_id: jobId,
          time: moment().valueOf(),
          herokuScript_name: name,
        })}`
      );
    }

    if (exit_status != 0) {
      await knex.table("jobs").delete().where("id", jobId);
      if (job)
        await slack.chat.postMessage({
          text: `Error in Job id ${jobId} for script ${job.script_location} ${process.env.PAPER_TRAIL_LINK}?q=${name}`,
          link: `${process.env.PAPER_TRAIL_LINK}?q=${name}`,
          channel: slack.generalChannelId,
        });

      console.log(
        `API_EVENT:::HEROKU_RUNNER:::ERROR:::${JSON.stringify({
          job_id: jobId,
          time: moment().valueOf(),
        })}`
      );
    }
  }

  return res.json({});
});

module.exports = router;
