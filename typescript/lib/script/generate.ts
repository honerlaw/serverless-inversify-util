#! /usr/bin/env node

import * as commander from "commander";
import {Generator} from "./generator";

commander
    .version("0.7.12")
    .option("-p, --project <project>", "relative path to tsconfig.json from project root directory")
    .option("-s, --service <service>", "relative path to service entry point from project root directory")
    .option("-d, --deploy [deploy]", "flag to run `serverless deploy`")
    .option("-e, --env [env]", "serverless deploy stage (environment)")
    .parse(process.argv);

const project: string = commander.project;
const service: string = commander.service;
const deploy: boolean = commander.deploy === "true" || commander.deploy === true;
const stage: string = commander.env;

if (project === undefined || service === undefined) {
    console.error("Invalid command! Example: serverless-inversify-util " +
        "-s relative/path/to/service/entry.ts -p relative/path/to/tsconfig.json");
    process.exit(1);
}

(new Generator(service, project, deploy, stage)).execute();
