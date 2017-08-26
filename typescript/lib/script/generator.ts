import * as fs from "fs";
import {Container} from "inversify";
import {ncp} from "ncp";
import * as path from "path";
import * as ts from "typescript";
import * as YAML from "yamljs";
import {IHandlerMetadata} from "../handler";
import {IServiceData, MetadataKey} from "../service";
import {IService, TYPE} from "../util";
import {HANDLER_TEMPLATE} from "./template";

export class Generator {

    private static CURRENT_DIR: string = path.resolve();
    private static OUT_DIR: string = path.resolve("./bin");

    private readonly mainPath: string;
    private readonly mainJsPath: string;
    private readonly compilerOptions: ts.CompilerOptions;

    constructor(mainPath: string, configPath: string) {
        this.mainPath = path.resolve(mainPath);
        this.mainJsPath = this.mainPath.replace(Generator.CURRENT_DIR, "").replace(".ts", ".js");
        this.compilerOptions = JSON.parse(fs.readFileSync(path.resolve(configPath)).toString()).compilerOptions;
        this.compilerOptions.outDir = Generator.OUT_DIR;
        this.compilerOptions.moduleResolution = (this.compilerOptions.moduleResolution as any) === "node" ? 2 : 1;
        this.compilerOptions.listEmittedFiles = true;
    }

    public execute(): void {
        const emittedFiles: string[] = this.compile();
        const services: IService[] = this.getServices(emittedFiles);

        // @todo get the generated files
        const contents: string[] = []; // [TEMPLATE.replace(new RegExp("{{setup}}", "g"), mainjs)];

        services.forEach((s: any) => {
            const serviceMetadata: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, s.constructor).data;

            // add each "handler" as a serverless function to yaml
            const functions: { [key: string]: object } = {};
            serviceMetadata.handlers.forEach((handler) => {
                const handlerMetadata: IHandlerMetadata[] = Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler);
                handlerMetadata.forEach((metadata) => {
                    const functionName: string = `${metadata.target.constructor.name}_${metadata.propertyKey}`;

                    // so we need to know the relative path to the handler.js file, which is just going to be handler.js
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
            fs.writeFileSync(path.join(Generator.OUT_DIR, "serverless.yml"), yaml);

            // write the handler.js file that hooks up everything
            fs.writeFileSync(path.join(Generator.OUT_DIR, "handler.js"), contents.join(""));
        });
    }

    private getTemplate(): string {
        const tsFilePath: string = path.join(__dirname, "handler.template.ts");
        const jsFilePath: string = path.join(__dirname, "handlertemplate.js");

        if (fs.existsSync(jsFilePath)) {
            return fs.readFileSync(jsFilePath).toString();
        }

        if (!fs.existsSync(tsFilePath)) {
            console.error("Could not find event handler template!");
            process.exit(1);
        }

        const contents: string = fs.readFileSync(tsFilePath).toString();
        const compilerOptions: ts.CompilerOptions = {};

        const outputs: any[] = [];

        const compilerHost: ts.CompilerHost = {
             getSourceFile: (filename, languageVersion) => {
                 if (filename === "template.ts") {
                     return ts.createSourceFile(filename, contents, compilerOptions.target, false);
                 }
                 return undefined;
             },
             writeFile: (name, text, writeByteOrderMark) => {
                 outputs.push({ name, text, writeByteOrderMark });
             },
             readFile: () => "",
             fileExists: () => true,
             getDirectories: () => [],
             getDefaultLibFileName: (options: ts.CompilerOptions) => "lib.d.ts",
             useCaseSensitiveFileNames: () => false,
             getCanonicalFileName: (filename) => filename,
             getCurrentDirectory: () => "",
             getNewLine: () => "\n"
         };

        ts.createProgram(["template.ts"], compilerOptions, compilerHost).emit();

        return outputs[0].text;
    }

    private compile(): string[] {
        const program: ts.Program = ts.createProgram([this.mainPath], this.compilerOptions);
        return program.emit().emittedFiles;
    }

    private copyNodeModules(): void {
        const source: string = path.resolve("./node_modules/");
        const dest: string = path.join(Generator.OUT_DIR, "node_modules");
        ncp(source, dest, (err) => {
            if (err) {
                console.error(err);
                process.exit(1);
            }
        });
    }

    private getContainer(emittedFiles: string[]): Container {
        let indexReq: any;
        emittedFiles
            .filter((file) => file.indexOf(".js.map") === -1)
            .forEach((file) => {
                const req = require(path.resolve(file));
                if (req.getContainer) {
                    indexReq = req;
                }
            });

        // @todo find a better way to handle this and the same in the template below
        if (!indexReq) {
            return require("serverless-inversify-util").getContainer();
        }
        return indexReq.getContainer();
    }

    private getServices(emittedFiles: string[]): IService[] {
        const container: Container = this.getContainer(emittedFiles);
        const services: IService[] = container.getAll<IService>(TYPE.Service);
        if (services.length !== 1) {
            console.error("Only one service can be generated at a time!");
            process.exit(1);
        }
        return services;
    }

}
