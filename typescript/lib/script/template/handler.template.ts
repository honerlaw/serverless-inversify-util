import {Container} from "inversify";
import "reflect-metadata";
import {HandlerMiddleware, IErrorHandlerMetadata, IHandlerMetadata} from "../../handler";
import {IParam, IParamMetadata} from "../../param";
import {IService} from "../../util";

import ".{{setup}}";

// fetch serverless-inversify-lib, hack allows testing
const lib = require("serverless-inversify-util"); // tslint:disable-line

// @todo this file needs to be cleaned up...
const container: Container = lib.getContainer();

export function getValueFromObject(object: object, vals: string[], index: number = 0): any {
    const val: string = vals[index];
    if (object.hasOwnProperty(val)) {
        if (vals.length - 1 === index) {
            return object[val];
        } else {
            return getValueFromObject(object[val], vals, ++index);
        }
    }
}

export function getParsedValue(data: IParam, val: string): any {
    if (data.parse) {
        return data.parse(val);
    }
    return val;
}

export function getPassParams(handler: any, method: any, methodName: string, event: any, context: any): any[] {
    // @todo if name is not supplied for path / param / body, use function parameter name instead
    const passParams: any[] = new Array(method.length);
    const params: IParamMetadata[] = Reflect.getOwnMetadata("param", handler.constructor);

    if (!params) {
        return passParams;
    }

    params.forEach((metadata) => {
        if (metadata.propertyKey === methodName) {
            const metadataIndex: number = metadata.descriptor as number;
            switch (metadata.data.type) {
                case "event":
                    passParams[metadataIndex] = event;
                    break;
                case "context":
                    passParams[metadataIndex] = context;
                    break;
                case "path":
                    if (event && event.pathParameters) {
                        passParams[metadataIndex] = getParsedValue(metadata.data,
                            event.pathParameters[metadata.data.name]);
                    }
                    break;
                case "param":
                    if (event && event.queryStringParameters) {
                        passParams[metadataIndex] = getParsedValue(metadata.data,
                            event.queryStringParameters[metadata.data.name]);
                    }
                    break;
                case "body":
                    if (!event || !event.headers || !event.body) {
                        break;
                    }

                    // @todo move to a service level middleware util
                    const header: string = "Content-Type";
                    const contentType: string = event.headers[header.toLowerCase()] || event.headers[header];
                    if (contentType.indexOf("application/x-www-form-urlencoded") !== -1
                        || contentType.indexOf("multipart/formdata") !== -1) {
                        const body: { [key: string]: string } = {};
                        event.body.split("&").map((val: string) => val.split("=")).forEach((pair: string[]) => {
                            body[pair[0]] = pair[1];
                        });
                        event._body = event.body;
                        event.body = body;
                    } else if (contentType.indexOf("application/json") !== -1) {
                        event._body = event.body;
                        try {
                            event.body = JSON.parse(event._body);
                        } catch (err) {
                            // do nothing if failed
                        }
                    }

                    passParams[metadataIndex] = getParsedValue(metadata.data,
                        event.body[metadata.data.name]);
                    break;
                case "event_value":
                    const eventValue: any = getValueFromObject(event, metadata.data.name.split("."));
                    passParams[metadataIndex] = getParsedValue(metadata.data, eventValue);
                    break;
                case "context_value":
                    const contextValue: any = getValueFromObject(context, metadata.data.name.split("."));
                    passParams[metadataIndex] = getParsedValue(metadata.data, contextValue);
                    break;
                case "header_value":
                    if (!event || !event.headers) {
                        break;
                    }
                    const headerKey: string = metadata.data.name;
                    const headerValue: any = event.headers[headerKey.toLowerCase()] || event.headers[headerKey];
                    passParams[metadataIndex] = getParsedValue(metadata.data, headerValue);
                    break;
            }
        }
    });
    return passParams;
}

// @todo general global life cycle methods?
// Generic method to handle incoming event and correctly pass on to registered handlers
export async function handle(serviceName: string,
                             methodName: string,
                             handlerName: string,
                             event: any,
                             context: any,
                             callback: (err: any, resp?: any) => void): Promise<void> {
    const service: IService = container.getNamed(lib.TYPE.Service, serviceName);
    const handler: any = container.getNamed(lib.TYPE.EventHandler, handlerName);
    try {
        const method = handler[methodName];

        if (!method) {
            callback(new Error("Method for event handler not found!"));
            return;
        }

        // trigger global pre-handle method
        if (service.preHandle) {
            await service.preHandle.call(service, event, context);
        }

        // get middleware for this handler's method
        const handlerMetadata: IHandlerMetadata[] = Reflect.getOwnMetadata("event_handler", handler.constructor);
        const foundMiddleware: HandlerMiddleware[] = handlerMetadata
            .filter((m) => m.propertyKey === methodName)
            .map((metadata) => metadata.middleware)
            .reduce((prev, next) => prev.concat(next), []);

        for (const middleware of foundMiddleware) {
            await Promise.resolve(middleware(event, context));
        }

        const passParams: any[] = getPassParams(handler, method, methodName, event, context);
        let resp: any = await Promise.resolve(method.apply(handler, passParams));

        // trigger global post-handle method
        if (service.postHandle) {
            resp = await service.postHandle.call(service, event, context, resp);
        }

        callback(null, resp);
    } catch (err) {
        const errorHandlerMetadata: IErrorHandlerMetadata = Reflect
            .getOwnMetadata("error_handler", handler.constructor);
        if (errorHandlerMetadata) {
            const resp = await Promise.resolve(errorHandlerMetadata.handler(err));
            if (resp !== undefined) {
                callback(null, resp);
                return;
            }
        }
        if (err.statusCode) {
            let errorResponse: any = {
                statusCode: err.statusCode,
                body: JSON.stringify({
                    message: err.message
                })
            };

            // also call post handle on the response out
            if (service.postHandle) {
                errorResponse = await service.postHandle.call(service, event, context, errorResponse);
            }

            return callback(null, errorResponse);
        }
        callback(err);
    }
}
