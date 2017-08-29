import {MetadataKey} from "./service";

export type HandlerMiddleware = (event: any, context: any) => void;
export type ErrorHandlerFunction = (err: any) => void;

export interface IErrorHandlerMetadata {
    handler: ErrorHandlerFunction;
}

export interface IHandlerEventMap {
    [type: string]: {
        [key: string]: any;
    };
}

export interface IHandlerEvent {
    eventMap: IHandlerEventMap;
    middleware?: HandlerMiddleware[];
}

export interface IHandlerMetadata {
    events: IHandlerEventMap[];
    middleware: HandlerMiddleware[];
    propertyKey: string;
    target: any;
}

// http specific event handler
export function HttpHandler(path: string,
                            method: "GET" | "POST" | "DELETE" | "PUT",
                            ...middleware: HandlerMiddleware[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, [{
        eventMap: {
            http: {
                path,
                method
            },
        },
        middleware
    }]);
}

export function S3Handler(bucket: string, event: string, ...middleware: HandlerMiddleware[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, [{
        eventMap: {
            s3: {
                bucket,
                event
            }
        },
        middleware
    }]);
}

// attaches generic event handler
export function Handler(...events: IHandlerEvent[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, events);
}

export function ErrorHandler(errorHandler: ErrorHandlerFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        const metadata: IErrorHandlerMetadata = {
            handler: errorHandler
        };
        Reflect.defineMetadata(MetadataKey.ERROR_HANDLER, metadata, target);
    };
}

// property key and target will always be the same for all events
function register(target: any, propertyKey: string, events: IHandlerEvent[]): void {
    const eventMaps: IHandlerEventMap[] = events.map((event) => event.eventMap);
    const middleware: HandlerMiddleware[] = events.map((event) => event.middleware)
        .reduce((prev, next) => prev.concat(next)) || [];

    const metadata: IHandlerMetadata = {
        events: eventMaps,
        middleware,
        propertyKey,
        target
    };

    let found: IHandlerMetadata[] = [];
    if (Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)) {
        found = Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor);
    }

    const existing: IHandlerMetadata[] = found.filter((handler) => handler.propertyKey === propertyKey);
    if (existing.length > 0) {
        existing.forEach((handler) => {
            handler.middleware = handler.middleware.concat(middleware);
            handler.events = handler.events.concat(eventMaps);
        });
    } else {
        found.push(metadata);
    }

    Reflect.defineMetadata(MetadataKey.EVENT_HANDLER, found, target.constructor);
}
