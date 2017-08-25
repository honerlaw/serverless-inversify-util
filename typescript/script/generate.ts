import * as fs from "fs";
import {Container} from "inversify";
import * as path from "path";
import * as ts from "typescript";
import * as YAML from "yamljs";
import {IHandlerMetadata} from "../lib/handler";
import {Service, TYPE} from "../lib/index";
import {IServiceData, MetadataKey} from "../lib/service";

/**
 *
 * This will be the core of the utility.
 *
 * 1. compiles the code down using given tsconfig (DONE)
 * 2. loads up the metadata from the generated code (DONE)
 * 3. builds the serverless.yml file from the metadata
 * 4. outputs everything into a directory that is then used to upload to serverless
 *
 */

if (process.argv.length !== 4) {
    console.error("Invalid usage! Example: generate.ts path/to/service.ts path/to/tsconfig.json");
    process.exit(1);
}

const currentDir: string = path.resolve();
const outDir: string = path.resolve("./bin");

const main: string = path.resolve(process.argv[2]);
const config: ts.CompilerOptions = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]))
    .toString()).compilerOptions;

// update config to work properly with createProgram
config.outDir = outDir;
config.moduleResolution = (config.moduleResolution as any) === "node" ? 2 : 1;
config.listEmittedFiles = true;

// create the program and compile / emit everything
const program: ts.Program = ts.createProgram([main], config);
const result: ts.EmitResult = program.emit();

// @todo should probably figure out a better way to load all files up and get the invserify container
function getContainer(): Container {
    let indexReq: any;
    result.emittedFiles
        .filter((file) => file.indexOf(".js.map") === -1)
        .forEach((file) => {
            const req = require(path.resolve(file));
            if (req.getContainer) {
                indexReq = req;
            }
        });
    return indexReq.getContainer();
}

const container: Container = getContainer();

// find all services that are registered
const services: Service[] = container.getAll<Service>(TYPE.Service);

// @todo allow multiple services
if (services.length !== 1) {
    console.error("Only one service can be generated at a time!");
    process.exit(1);
}

const mainjs: string = main.replace(currentDir, "").replace(".ts", ".js");
let contents: string = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// run the setup file
require(".${mainjs}");

// get serverless-decorators lib in order to get the inversify container
var lib = require("./typescript/lib/index.js");

var container = lib.getContainer();

`;

const template: string = `function {{methodName}}(event, context, callback) {
    var handler = container.getNamed(lib.TYPE.EventHandler, {{handlerName}});
    var method = handler["{{methodName}}"];

    // get middleware for this handler's method
    var found;
    var metadata = Reflect.getOwnMetadata("event_handler", handler.constructor);
    metadata.forEach(function(m) {
        if (m.propertyKey === "{{methodName}}") {
            found = m;
        }
    });

    try {
        if (found) {
            for (var index in found.middleware) {
                found.middleware[index](event, context);
            }
        }
        callback(null, method());
    } catch (err) {
        return callback(err);
    }
}
exports.{{methodName}} = {{methodName}};

{{methodName}}(null, null, function() {
    console.log("CALLED", arguments);
});

`;

services.forEach((s: any) => {
    const serviceMetadata: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, s.constructor).data;

    // add each "handler" as a serverless function to yaml
    const functions: { [key: string]: object } = {};
    serviceMetadata.handlers.forEach((handler) => {
        const handlerMetadata: IHandlerMetadata[] = Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler);
        handlerMetadata.forEach((metadata) => {
            functions[metadata.propertyKey] = {
                handler: "unknown", // @todo proper path to method
                events: metadata.events
            };

            // add the function to the handler.js file
            contents += template
                .replace(new RegExp("{{methodName}}", "g"), metadata.propertyKey)
                .replace(new RegExp("{{handlerName}}", "g"), `"${metadata.target.constructor.name}"`);
        });
    });

    // fix config before converting to yaml
    delete serviceMetadata.handlers;
    (serviceMetadata as any).functions = functions;

    // convert to yaml and write to file in proper directory
    const yaml: string = YAML.stringify(serviceMetadata, Infinity, 2);
    fs.writeFileSync(path.join(outDir, "serverless.yml"), yaml);

    // write the handler.js file that hooks up everything
    fs.writeFileSync(path.join(outDir, "handler.js"), contents);
});
