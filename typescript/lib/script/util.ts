import * as fs from "fs-extra";
import {Container} from "inversify";
import * as path from "path";
import * as YAML from "yamljs";
import {IHandlerMetadata} from "../handler";
import {IServiceData, MetadataKey} from "../service";
import {IService, TYPE} from "../util";
import {IMetadata} from "./generator";

const MAX_LAMBDA_NAME_SIZE: number = 64;

export function getContainer(emittedFiles: string[]): Container {
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
    return require(__filename.indexOf(".ts") !== -1 ? "../index" : "serverless-inversify-util").getContainer();
}

export function getService(emittedFiles: string[]): IService {
    const container: Container = getContainer(emittedFiles);
    const services: IService[] = container.getAll<IService>(TYPE.Service);

    if (services.length !== 1) {
        throw new Error("You can only have one service per entry file!");
    }
    return services[0];
}

export interface IMetadataOptions {
    stage?: string;
    trim?: boolean;
}

export function getMetadata(service: IService, options: IMetadataOptions): IMetadata {
    const serviceData: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, service.constructor).data;
    const handlers: IHandlerMetadata[][] = serviceData.handlers
        .map((handler) => Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, handler));

    if (options.stage) {
        serviceData.provider.stage = options.stage;
    }

    return {
        service: serviceData,
        handlers,
        trim: options.trim
    };
}

export function createServerlessYAML(metadatum: IMetadata, outDir: string): void {
    // generate the function config from metadata
    const functions: { [key: string]: object } = {};
    metadatum.handlers.forEach((handlers: IHandlerMetadata[]) => {
        handlers.forEach((handler) => {
            const functionName: string = getFunctionName(metadatum, handler);
            functions[functionName] = {
                handler: `handler.${functionName}`,
                events: handler.events
            };
        });
    });
    const clone: IMetadata = JSON.parse(JSON.stringify(metadatum));
    delete clone.service.handlers;
    (clone.service as any).functions = functions;
    const yaml: string = YAML.stringify(clone.service, Infinity, 2);
    fs.writeFileSync(path.join(outDir, "serverless.yml"), yaml);
}

export function getFunctionName(metadata: IMetadata, handler: IHandlerMetadata): string {
    const service: IServiceData = metadata.service;
    const stage: string = service.provider.stage;
    const trim: boolean = metadata.trim;
    const functionName: string = `${handler.target.constructor.name}_${handler.propertyKey}`;
    const prefix: string = `${service.service}-${stage}-`;
    const fullName: string = `${prefix}${functionName}`;

    if (prefix.length > MAX_LAMBDA_NAME_SIZE) {
        throw new Error(`The service and stage name prefix '${prefix}' for the lambda name is too long!`);
    }

    // not trimming and full lambda name is greater than max size
    if (trim !== true && fullName.length > MAX_LAMBDA_NAME_SIZE) {
        throw new Error(`The full lambda name '${fullName}' is over 64 characters in length!
            You can use the -t flag in order trim the class and method name or change them to be shorter.`);
    }

    if (trim !== true || fullName.length < MAX_LAMBDA_NAME_SIZE) {
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
