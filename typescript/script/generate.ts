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
 * 3. builds the serverless.yml file from the metadata (DONE)
 * 4. outputs everything into a directory that is then used to upload to serverless (DONE)
 * 5. correctly parse and map data to given handler (DONE)
 *
 * @todo heavily refactor this after basic functionality is complete (e.g. the above)
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
let contents: string = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// run the setup file
require(".${mainjs}");

// get serverless-decorators lib in order to get the inversify container
var lib = require("./typescript/lib/index.js");

var container = lib.getContainer();

// Generic method to handle incoming event and correctly pass on to registered handlers
function handle(methodName, handlerName, event, context, callback) {
    var handler = container.getNamed(lib.TYPE.EventHandler, handlerName);
    var method = handler[methodName];

    // get middleware for this handler's method
    var foundMetadata;
    var metadata = Reflect.getOwnMetadata("event_handler", handler.constructor);
    metadata.forEach(function(m) {
        if (m.propertyKey === methodName) {
            foundMetadata = m;
        }
    });

    var passParams = [];
    var params = Reflect.getOwnMetadata("param", handler.constructor);
    params.forEach(function(p) {
        if (p.propertyKey === methodName) {
            switch (p.data.type) {
                case "event":
                    passParams.push(event);
                    break;
                case "context":
                    passParams.push(context);
                    break;
                case "path":
                    passParams.push(event.pathParameters[p.data.name]);
                    break;
                case "param":
                    passParams.push(event.queryStringParameters[p.data.name]);
                    break;
                case "body":
                    // @todo implement
                    break;
                default:
                    passParams.push(undefined);
                    break;
            }
        }
    });

    try {
        if (foundMetadata) {
            for (var index in foundMetadata.middleware) {
                foundMetadata.middleware[index](event, context);
            }
        }
        callback(null, method(...(passParams.reverse())));
    } catch (err) {
        return callback(err);
    }
}

`;

const template: string = `function {{functionName}}(event, context, callback) {
    handle("{{methodName}}", "{{handlerName}}", event, context, callback);
}
exports.{{functionName}} = {{functionName}};

`;

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
            contents += template
                .replace(new RegExp("{{functionName}}", "g"), functionName)
                .replace(new RegExp("{{methodName}}", "g"), metadata.propertyKey)
                .replace(new RegExp("{{handlerName}}", "g"), `${metadata.target.constructor.name}`);
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

// @todo copy over node_modules into the outDir
