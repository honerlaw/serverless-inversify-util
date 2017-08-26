import {Container} from "inversify";
import "reflect-metadata";
import {IHandlerMetadata} from "../handler";
import {IParamMetadata} from "../param";

// run the setup file
require(".{{setup}}"); // tslint:disable-line

// get serverless-decorators lib in order to get the inversify container
const lib = require("serverless-inversify-util"); // tslint:disable-line

const container: Container = lib.getContainer();

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

    let paramCount: number = 0;
    const passParams: { [key: number]: any } = {};
    const params: IParamMetadata[] = Reflect.getOwnMetadata("param", handler.constructor);
    params.forEach((metadata) => {
        if (metadata.propertyKey === methodName) {
            const metadataIndex: number = metadata.descriptor as number;

            if (metadataIndex > paramCount) {
                paramCount = metadataIndex;
            }
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
                    // @todo implement
                    break;
            }
        }
    });

    const passParamsArr = new Array(paramCount);
    for (const paramIndex in passParams) {
        if (passParams.hasOwnProperty(paramIndex)) {
            passParamsArr[paramIndex] = passParams[paramIndex];
        }
    }

    // wrap everything in a promise (handle both promise and non-promise)
    const promises: Array<Promise<any>> = [];
    if (foundHandlerMetadata) {
        foundHandlerMetadata.middleware.forEach((middleware) => {
            promises.push(Promise.resolve(middleware(event, context)));
        });
    }
    promises.push(Promise.resolve(method.apply(handler, passParamsArr)));

    // wait for everything to resolve
    Promise.all(promises).then((values: any[]) => {

        // the response is the last promises's result
        callback(null, values[promises.length - 1]);
    }).catch((err) => {
        if (err.statusCode) {
            return callback(null, {
                statusCode: err.statusCode,
                body: JSON.stringify({
                    message: err.message
                })
            });
        }
        callback(err);
    });
}
