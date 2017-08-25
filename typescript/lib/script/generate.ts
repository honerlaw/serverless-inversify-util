#! /usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import * as YAML from "yamljs";
import {IHandlerMetadata} from "../handler";
import {IService, TYPE} from "../index";
import {IServiceData, MetadataKey} from "../service";
import {HANDLER_TEMPLATE, TEMPLATE} from "./template";
import {getServices} from "./util";

// @todo better argument stuff
if (process.argv.length !== 4) {
    console.error("Invalid usage! Example: generate.ts path/to/service.ts path/to/tsconfig.json");
    process.exit(1);
}

const CURRENT_DIR: string = path.resolve();
const OUT_DIR: string = path.resolve("./bin");

const main: string = path.resolve(process.argv[2]);
const compilerOptions: ts.CompilerOptions = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]))
    .toString()).compilerOptions;

// update config to work properly with createProgram
compilerOptions.outDir = OUT_DIR;
compilerOptions.moduleResolution = (compilerOptions.moduleResolution as any) === "node" ? 2 : 1;
compilerOptions.listEmittedFiles = true;

// create the program and compile / emit everything
const program: ts.Program = ts.createProgram([main], compilerOptions);
const result: ts.EmitResult = program.emit();

const mainjs: string = main.replace(CURRENT_DIR, "").replace(".ts", ".js");
const contents: string[] = [TEMPLATE.replace(new RegExp("{{setup}}", "g"), mainjs)];

// find all services that are registered
const services: IService[] = getServices(result.emittedFiles);

// @todo split this up
services.forEach((s: any) => {
    const serviceMetadata: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, s.constructor).data;

    // add each "handler" as a serverless function to yaml
    const functions: { [key: string]: object } = {};
    serviceMetadata.handlers.forEach((handler) => {
        const handlerMetadata: IHandlerMetadata[] = Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler);
        handlerMetadata.forEach((metadata) => {
            const functionName: string = `${metadata.target.constructor.name}_${metadata.propertyKey}`;

            // so we need to know the relative path to the handler.js file, which is just going to be handler.js...
            functions[metadata.propertyKey] = {
                handler: `handler.${functionName}`,
                events: metadata.events
            };

            // add the function to the handler.js file
            // @todo proper template engine
            contents.push(HANDLER_TEMPLATE
                .replace(new RegExp("{{functionName}}", "g"), functionName)
                .replace(new RegExp("{{methodName}}", "g"), metadata.propertyKey)
                .replace(new RegExp("{{handlerName}}", "g"), `${metadata.target.constructor.name}`));
        });
    });

    // fix config before converting to yaml
    delete serviceMetadata.handlers;
    (serviceMetadata as any).functions = functions;

    // convert to yaml and write to file in proper directory
    const yaml: string = YAML.stringify(serviceMetadata, Infinity, 2);
    fs.writeFileSync(path.join(OUT_DIR, "serverless.yml"), yaml);

    // write the handler.js file that hooks up everything
    fs.writeFileSync(path.join(OUT_DIR, "handler.js"), contents.join(""));
});

// @todo copy over node_modules into the outDir
