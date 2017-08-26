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

interface IMetadata {
    service: IServiceData;
    handlers: IHandlerMetadata[];
}

export class Generator {

    private static CURRENT_DIR: string = path.resolve();
    private static OUT_DIR: string = path.resolve("./bin");
    private static writeFile(fileName: string, contents: string): void {
        fs.writeFileSync(path.join(Generator.OUT_DIR, fileName), contents);
    }

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

        const metadata: IMetadata[] = this.getMetadata(services);

        const template: string = this.getTemplate();

        metadata.forEach((metadatum) => {
            const yaml: string = this.getServerlessYAMLConfig(metadatum);
            const contents: string = this.getContents(template, metadatum);

            Generator.writeFile("serverless.yml", yaml);
            Generator.writeFile("handler.js", contents);
        });
    }

    private getContents(template: string, metadatum: IMetadata): string {
        // @todo proper template engine
        const contents: string[] = [template.replace(new RegExp("{{setup}}", "g"), this.mainJsPath)];
        metadatum.handlers.forEach((handler: IHandlerMetadata) => {
            const functionName: string = `${handler.target.constructor.name}_${handler.propertyKey}`;
            contents.push(HANDLER_TEMPLATE
                .replace(new RegExp("{{functionName}}", "g"), functionName)
                .replace(new RegExp("{{methodName}}", "g"), handler.propertyKey)
                .replace(new RegExp("{{handlerName}}", "g"), `${handler.target.constructor.name}`));
        });
        return contents.join("");
    }

    private getServerlessYAMLConfig(metadatum: IMetadata): string {
        const clone: IMetadata = JSON.parse(JSON.stringify(metadatum));
        delete clone.service.handlers;

        // generate the function config from metadata
        const functions: { [key: string]: object } = {};
        clone.handlers.forEach((handler: IHandlerMetadata) => {
            const functionName: string = `${handler.target.constructor.name}_${handler.propertyKey}`;
            functions[handler.propertyKey] = {
                handler: `handler.${functionName}`,
                events: handler.events
            };
        });
        (clone.service as any).functions = functions;

        return YAML.stringify(clone.service, Infinity, 2);
    }

    private getMetadata(services: IService[]): IMetadata[] {
        const metadata: IMetadata[] = [];
        services.forEach((s: any) => {
            const service: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, s.constructor).data;
            const handlers: IHandlerMetadata[] = service.handlers
                .map((handler) => Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler));
            metadata.push({
                service,
                handlers
            });
        });
        return metadata;
    }

    private getTemplate(): string {
        // handle either the compiled js or the non-compiled ts
        const tsFilePath: string = path.join(__dirname, "handler.template.ts");
        const jsFilePath: string = path.join(__dirname, "handler.template.js");

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
                outputs.push({name, text, writeByteOrderMark});
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
