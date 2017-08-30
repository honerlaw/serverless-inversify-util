import * as child from "child_process";
import * as fs from "fs-extra";
import {Container} from "inversify";
import * as path from "path";
import "reflect-metadata";
import * as ts from "typescript";
import * as YAML from "yamljs";
import {IHandlerMetadata} from "../handler";
import {IServiceData, MetadataKey} from "../service";
import {IService, TYPE} from "../util";

export interface IMetadata {
    service: IServiceData;
    handlers: IHandlerMetadata[][];
}

const HANDLER_TEMPLATE: string = `
function {{functionName}}(event, context, callback) {
    handle("{{methodName}}", "{{handlerName}}", event, context, callback);
}
exports.{{functionName}} = {{functionName}};
`;

/**
 * TODO
 * - better translation for compilerOptions (e.g. target "es5" becomes ts.ScriptTarget.ES5)
 */

const MAX_LAMBDA_NAME_SIZE: number = 64;

export class Generator {

    private static CURRENT_DIR: string = path.resolve();

    private static writeFile(outDir: string, fileName: string, contents: string): void {
        fs.writeFileSync(path.join(outDir, fileName), contents);
    }

    private readonly mainPath: string;
    private readonly mainJsPath: string;
    private readonly deploy: boolean;
    private readonly stage: string;
    private readonly trim: boolean;
    private readonly compilerOptions: ts.CompilerOptions;

    constructor(mainPath: string, config: string | object, deploy?: boolean, stage?: string, trim?: boolean) {
        this.mainPath = path.resolve(mainPath);
        this.mainJsPath = this.mainPath.replace(Generator.CURRENT_DIR, "").replace(".ts", ".js");
        this.compilerOptions = (typeof config === "string" ?
            JSON.parse(fs.readFileSync(path.resolve(config)).toString()).compilerOptions : config);
        this.deploy = deploy;
        this.stage = stage;
        this.trim = trim;
    }

    public execute(binDir: string = "./bin"): void {
        const emittedFiles: string[] = this.compile(binDir);
        const template: string = this.getTemplate();

        const service: IService = this.getService(emittedFiles);
        const metadata: IMetadata = this.getMetadata(service);

        const yaml: string = this.getServerlessYAMLConfig(metadata);
        const contents: string = this.getContents(template, this.mainJsPath, metadata);

        const formattedName: string = metadata.service.service.replace(/[^a-zA-Z]/g, "");
        const outDir: string = path.join(path.resolve(binDir), formattedName);

        // make sure directory exists to copy into
        fs.ensureDirSync(outDir);

        // write all of the files to the correct outDir path (./bin/serviceName)
        Generator.writeFile(outDir, "serverless.yml", yaml);
        Generator.writeFile(outDir, "handler.js", contents);
        this.copyNodeModules(outDir);
        this.copyFiles(path.resolve(binDir), outDir, emittedFiles);

        // deploy the service if the deploy flag set
        this.deployService(outDir);
    }

    private getContents(template: string, mainJsPath: string, metadatum: IMetadata): string {
        // @todo proper template engine

        const temp: string = template.replace(new RegExp("{{setup}}", "g"), mainJsPath);

        const contents: string[] = [temp];
        metadatum.handlers.forEach((handlers: IHandlerMetadata[]) => {
            handlers.forEach((handler) => {
                const functionName: string = this.getFunctionName(metadatum.service, handler);
                contents.push(HANDLER_TEMPLATE
                    .replace(new RegExp("{{functionName}}", "g"), functionName)
                    .replace(new RegExp("{{methodName}}", "g"), handler.propertyKey)
                    .replace(new RegExp("{{handlerName}}", "g"), `${handler.target.constructor.name}`));
            });
        });
        return contents.join("");
    }

    private getServerlessYAMLConfig(metadatum: IMetadata): string {
        // generate the function config from metadata
        const functions: { [key: string]: object } = {};
        metadatum.handlers.forEach((handlers: IHandlerMetadata[]) => {
            handlers.forEach((handler) => {
                const functionName: string = this.getFunctionName(metadatum.service, handler);
                functions[functionName] = {
                    handler: `handler.${functionName}`,
                    events: handler.events
                };
            });
        });
        const clone: IMetadata = JSON.parse(JSON.stringify(metadatum));
        delete clone.service.handlers;
        (clone.service as any).functions = functions;
        clone.service.provider.stage = this.getStage(metadatum.service);
        return YAML.stringify(clone.service, Infinity, 2);
    }

    private getMetadata(service: IService): IMetadata {
        const serviceData: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, service.constructor).data;
        const handlers: IHandlerMetadata[][] = serviceData.handlers
            .map((handler) => Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler));
        return {
            service: serviceData,
            handlers
        };
    }

    private getTemplate(): string {
        // handle either the compiled js or the non-compiled ts
        const tsFilePath: string = path.join(__dirname, "handler.template.ts");
        const jsFilePath: string = path.join(__dirname, "handler.template.js");

        /* istanbul ignore next */
        if (fs.existsSync(jsFilePath)) {
            return fs.readFileSync(jsFilePath).toString();
        }

        /* istanbul ignore next */
        if (!fs.existsSync(tsFilePath)) {
            throw new Error("Could not find event handler template!");
        }

        const contents: string = fs.readFileSync(tsFilePath).toString();
        const compilerOptions: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES5
        };

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
            fileExists: () => true,
            getDefaultLibFileName: (options: ts.CompilerOptions) => "lib.d.ts",
            useCaseSensitiveFileNames: () => false,
            getCanonicalFileName: (filename) => filename,
            getCurrentDirectory: () => "",
            getNewLine: () => "\n"
        } as any;

        ts.createProgram(["template.ts"], compilerOptions, compilerHost).emit();

        return outputs[0].text;
    }

    private compile(outDir: string): string[] {
        // @todo better conversion of compiler options
        this.compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
        if ((this.compilerOptions.moduleResolution as any) !== "node") {
            this.compilerOptions.moduleResolution = ts.ModuleResolutionKind.Classic;
        }
        this.compilerOptions.listEmittedFiles = true;
        this.compilerOptions.target = ts.ScriptTarget.ES5;
        this.compilerOptions.outDir = path.resolve(outDir);
        const program: ts.Program = ts.createProgram([this.mainPath], this.compilerOptions);
        return program.emit().emittedFiles;
    }

    private copyFiles(binDir: string, outDir: string, emitted: string[]): void {

        emitted.forEach((file) => {
            const dest: string = path.join(outDir, file.replace(binDir, ""));

            const destDir: string = dest.split(path.sep).slice(0, -1).join(path.sep);

            fs.ensureDirSync(destDir);

            fs.writeFileSync(dest, fs.readFileSync(file));
        });
    }

    private deployService(outDir: string): void {
        if (this.deploy !== true) {
            return;
        }

        const c: child.ChildProcess = child.exec(`cd ${outDir} && serverless deploy`,
            /* istanbul ignore next */
            (error: Error, stdout: string, stderr: string) => {
                if (error) {
                    throw error;
                }
            });
        c.stderr.pipe(process.stdout);
        c.stdout.pipe(process.stderr);
    }

    private copyNodeModules(outDir: string): void {
        const source: string = path.resolve("./node_modules/");
        const dest: string = path.join(outDir, "node_modules");
        fs.copySync(source, dest);
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
        if (indexReq !== undefined) {
            return indexReq.getContainer();
        }

        // hack to allow running local and when a package
        /* istanbul ignore next */
        return require(__filename.indexOf(".ts") !== -1 ? "../index" : "serverless-inversify-util").getContainer();
    }

    private getService(emittedFiles: string[]): IService {
        const container: Container = this.getContainer(emittedFiles);
        const services: IService[] = container.getAll<IService>(TYPE.Service);

        /* istanbul ignore next */
        if (services.length !== 1) {
            throw new Error("You can only have one service per entry file!");
        }
        return services[0];
    }

    private getStage(service: IServiceData): string {
        if (this.stage) {
            return this.stage;
        }
        return service.provider.stage;
    }

    private getFunctionName(service: IServiceData, handler: IHandlerMetadata): string {
        const stage: string = this.getStage(service);
        const functionName: string = `${handler.target.constructor.name}_${handler.propertyKey}`;
        const prefix: string = `${service.service}-${stage}-`;
        const fullName: string = `${prefix}${functionName}`;

        if (prefix.length > MAX_LAMBDA_NAME_SIZE) {
            throw new Error(`The service and stage name prefix '${prefix}' for the lambda name is too long!`);
        }

        // not trimming and full lambda name is greater than max size
        if (this.trim !== true && fullName.length > MAX_LAMBDA_NAME_SIZE) {
            throw new Error(`The full lambda name '${fullName}' is over 64 characters in length!
            You can use the -t flag in order trim the class and method name or change them to be shorter.`);
        }

        if (this.trim !== true || fullName.length < MAX_LAMBDA_NAME_SIZE) {
            return functionName;
        }

        // subtract the prefix and underscore that is used to split the class name and method name
        const remaining: number = (MAX_LAMBDA_NAME_SIZE - prefix.length) - 1;

        if (remaining <= 2) {
            throw new Error(`The service and stage name prefix '${prefix}' for the lambda name is too long!`);
        }

        // split in half, give more characters to method name than class name
        const size: number = remaining / 2;
        const classNameLength: number = Math.floor(size);
        const methodNameLength: number = Math.ceil(size);
        const className: string = handler.target.constructor.name.substr(0, classNameLength);
        const methodName: string = handler.propertyKey.substr(0, methodNameLength);

        // return the trimmed serverless lamba function name without prefix (added by serverless deploy)
        return `${className}_${methodName}`;
    }

}
