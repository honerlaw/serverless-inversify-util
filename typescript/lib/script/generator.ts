import * as child from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import "reflect-metadata";
import * as ts from "typescript";
import * as webpack from "webpack";
import {IHandlerMetadata} from "../handler";
import {IServiceData} from "../service";
import * as Compiler from "./compiler";
import {TemplateBuilder} from "./template/template-builder";
import * as Util from "./util";
import {IService} from "../util";

export interface IMetadata {
    service: IServiceData;
    handlers: IHandlerMetadata[][];
    trim: boolean;
}

export class Generator {

    private readonly TemplateBuilder: TemplateBuilder;
    private readonly mainPath: string;
    private readonly config: string | ts.CompilerOptions;
    private readonly shouldDeploy: boolean;
    private readonly stage: string;
    private readonly trim: boolean;

    constructor(mainPath: string, config: string | ts.CompilerOptions,
                shouldDeploy?: boolean, stage?: string, trim?: boolean) {
        this.mainPath = path.resolve(mainPath);
        this.config = config;
        this.TemplateBuilder = new TemplateBuilder(this.mainPath);
        this.shouldDeploy = shouldDeploy;
        this.stage = stage;
        this.trim = trim;
    }

    public async execute(): Promise<void> {
        const outDir: string = path.resolve("./bin");

        // compile typescript down
        const emittedFiles: string[] = Compiler.compile(this.mainPath, outDir, this.config);

        // fetch metadata from emitted files
        const service: IService = Util.getService(emittedFiles);
        const metadata: IMetadata = Util.getMetadata(service, {
            stage: this.stage,
            trim: this.trim
        });

        // build and write the handler.template file
        const templateFilePath: string = this.TemplateBuilder.save(outDir, metadata);

        // where the final webpack file / serverless file exist
        const finalDir: string = path.resolve("./build");

        // run webpack
        await this.pack(templateFilePath, finalDir);

        // create the serverless.yml file
        Util.createServerlessYAML(metadata, finalDir);

        // remove unneeded generated / compiled files
        fs.emptyDirSync(outDir);
        fs.rmdirSync(outDir);
    }

    private pack(entry: string, outDir: string): Promise<webpack.Stats> {
        const config: webpack.Configuration = {
            entry,
            output: {
                libraryTarget: "commonjs",
                path: outDir,
                filename: "handler.js",
            },
            target: "node",
        };
        return new Promise<webpack.Stats>((resolve, reject) => {
            webpack(config).run((err: Error, stats: webpack.Stats) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(stats);
            });
        });
    }

    private deploy(outDir: string): void {
        if (this.shouldDeploy !== true) {
            return;
        }

        const c: child.ChildProcess = child.exec(`cd ${outDir} && serverless deploy`,
            (error: Error, stdout: string, stderr: string) => {
                if (error) {
                    throw error;
                }
            });
        c.stderr.pipe(process.stdout);
        c.stdout.pipe(process.stderr);
    }

}
