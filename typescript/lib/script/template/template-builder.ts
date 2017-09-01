import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";
import {IHandlerMetadata} from "../../handler";
import {IMetadata} from "../generator";
import * as Compiler from "../compiler";
import * as Util from "../util";

const HANDLER_TEMPLATE: string = `
function {{functionName}}(event, context, callback) {
    handle("{{methodName}}", "{{handlerName}}", event, context, callback);
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

    public save(dir: string, metadatum: IMetadata): string {
        const fullPath: string = path.join(dir, "handler.js");
        fs.writeFileSync(fullPath, this.getContents(metadatum));
        return fullPath;
    }

    private getContents(metadatum: IMetadata): string {
        const template: string = this.getTemplate();

        // @todo proper template engine
        const temp: string = template
            .replace(new RegExp("{{setup}}", "g"), this.mainJsPath)
            .replace(new RegExp("{{lib}}", "g"), __filename.indexOf(".ts") ? "../util" : "serverless-inversify-util");

        const contents: string[] = [temp];
        metadatum.handlers.forEach((handlers: IHandlerMetadata[]) => {
            handlers.forEach((handler) => {
                const functionName: string = Util.getFunctionName(metadatum, handler);
                contents.push(HANDLER_TEMPLATE
                    .replace(new RegExp("{{functionName}}", "g"), functionName)
                    .replace(new RegExp("{{methodName}}", "g"), handler.propertyKey)
                    .replace(new RegExp("{{handlerName}}", "g"), `${handler.target.constructor.name}`));
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
