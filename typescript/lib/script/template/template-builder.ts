import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";
import {IHandlerMetadata} from "../../handler";
import {IService} from "../../util";
import * as Compiler from "../compiler";
import {IMetadata} from "../generator";
import * as Util from "../util";

const HANDLER_TEMPLATE: string = `
function {{functionName}}(event, context, callback) {
    handle("{{serviceName}}", "{{methodName}}", "{{handlerName}}", event, context, callback);
}
exports.{{functionName}} = {{functionName}};
`;

export class TemplateBuilder {

    private readonly mainJsPath: string;

    constructor(mainTsPath: string) {
        this.mainJsPath = mainTsPath
            .replace(path.resolve(), "")
            .replace(".ts", ".js");
    }

    public save(dir: string, service: IService, metadatum: IMetadata): string {
        const fullPath: string = path.join(dir, "handler.js");
        fs.writeFileSync(fullPath, this.getContents(service, metadatum));
        return fullPath;
    }

    private getContents(service: IService, metadatum: IMetadata): string {
        const template: string = this.getTemplate();

        // @todo proper template engine
        const temp: string = template
            .replace(new RegExp("{{setup}}", "g"), this.mainJsPath);

        const contents: string[] = [temp];
        metadatum.handlers.forEach((handlers: IHandlerMetadata[]): void => {
            handlers.forEach((handler): void => {
                const functionName: string = Util.getFunctionName(metadatum, handler);
                contents.push(HANDLER_TEMPLATE
                    .replace(new RegExp("{{serviceName}}", "g"), service.constructor.name)
                    .replace(new RegExp("{{functionName}}", "g"), functionName)
                    .replace(new RegExp("{{methodName}}", "g"), handler.propertyKey)
                    .replace(new RegExp("{{handlerName}}", "g"), handler.target.constructor.name));
            });
        });
        return contents.join("");
    }

    private getTemplate(): string {
        // handle either the compiled js or the non-compiled ts
        const tsFilePath: string = path.join(__dirname, "handler.template.ts");
        const jsFilePath: string = path.join(__dirname, "handler.template.js");

        if (fs.existsSync(jsFilePath)) {
            return fs.readFileSync(jsFilePath).toString();
        }

        if (!fs.existsSync(tsFilePath)) {
            throw new Error("Could not find event handler template!");
        }

        return Compiler.compileToString(tsFilePath);
    }

}
