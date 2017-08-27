import {Container} from "inversify";
import "reflect-metadata";
import {IHandlerMetadata} from "../handler";
import {IParamMetadata} from "../param";

// run the setup file
require(".{{setup}}"); // tslint:disable-line

// get serverless-decorators lib in order to get the inversify container
// hack to allow running local and when a package
const lib = require(__filename.indexOf(".ts") !== -1 ? "../util" : "serverless-inversify-util"); // tslint:disable-line

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

// Generic method to handle incoming event and correctly pass on to registered handlers
export function handle(methodName: string, handlerName: string, event, context, callback) {
    const handler: any = container.getNamed(lib.TYPE.EventHandler, handlerName);
    const method = handler[methodName];

    // get middleware for this handler's method
    let foundHandlerMetadata;
    const handlerMetadata: IHandlerMetadata[] = Reflect.getOwnMetadata("event_handler", handler.constructor);
    handlerMetadata.forEach((metadata) => {
        if (metadata.propertyKey === methodName) {
            foundHandlerMetadata = metadata;
        }
    });

    // @todo if name is not supplied for path / param / body, use function parameter name instead
    const passParams: any[] = new Array(method.length);
    const params: IParamMetadata[] = Reflect.getOwnMetadata("param", handler.constructor);
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
                        passParams[metadataIndex] = event.pathParameters[metadata.data.name];
                    }
                    break;
                case "param":
                    if (event && event.queryStringParameters) {
                        passParams[metadataIndex] = event.queryStringParameters[metadata.data.name];
                    }
                    break;
                case "body":
                    if (!event || !event.headers || !event.body) {
                        return;
                    }

                    // @todo move to a service level middleware util
                    const header: string = "Content-Type";
                    const contentType: string = event.headers[header.toLowerCase()] || event.headers[header];
                    if (contentType.indexOf("application/x-www-form-urlencoded") !== -1
                        || contentType.indexOf("multipart/formdata") !== -1) {
                        const body: Map<string, string> = new Map();
                        event.body.split("&").map((val: string) => val.split("=")).forEach((pair: string[]) => {
                            body.set(pair[0], pair[1]);
                        });
                        event._body = event.body;
                        event.body = body;
                    } else if (contentType.indexOf("application/json") !== -1) {
                        event._body = event.body;
                        event.body = JSON.parse(event._body);
                    }

                    passParams[metadataIndex] = event.body[metadata.data.name];
                    break;
                case "event_value":
                    passParams[metadataIndex] = getValueFromObject(event, metadata.data.name.split("."));
                    break;
                case "context_value":
                    passParams[metadataIndex] = getValueFromObject(context, metadata.data.name.split("."));
                    break;
                case "header_value":
                    if (!event || !event.headers) {
                        return;
                    }
                    const headerKey: string = metadata.data.name;
                    passParams[metadataIndex] = event.headers[headerKey.toLowerCase()] || event.headers[headerKey];
                    break;
            }
        }
    });

    const handlerError = (err) => {
        if (err.statusCode) {
            return callback(null, {
                statusCode: err.statusCode,
                body: JSON.stringify({
                    message: err.message
                })
            });
        }
        callback(err);
    };

    try {
        // wrap everything in a promise (handle both promise and non-promise)
        const promises: Array<Promise<any>> = [];
        if (foundHandlerMetadata) {
            foundHandlerMetadata.middleware.forEach((middleware) => {
                promises.push(Promise.resolve(middleware(event, context)));
            });
        }
        promises.push(Promise.resolve(method.apply(handler, passParams)));

        // wait for everything to resolve
        Promise.all(promises).then((values: any[]) => {

            // the response is the last promises's result
            callback(null, values[promises.length - 1]);
        }).catch(handlerError);

    } catch (err) {
        handlerError(err);
    }
}
