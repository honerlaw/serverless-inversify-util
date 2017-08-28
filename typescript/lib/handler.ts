import {MetadataKey} from "./service";

export type HandlerMiddleware = (event: any, context: any) => void;

export interface IHandlerEvent {
    [type: string]: {
        [key: string]: string;
    };
}

export interface IHandlerMetadata {
    events: IHandlerEvent[];
    middleware: HandlerMiddleware[];
    propertyKey: string;
    target: any;
}

// http specific event handler
export function HttpHandler(path: string,
                            method: "GET" | "POST" | "DELETE" | "PUT",
                            ...middleware: HandlerMiddleware[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, middleware, [{
        http: {
            path,
            method
        }
    }]);
}

export function S3Handler(bucket: string, event: string, ...middleware: HandlerMiddleware[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, middleware, [{
        s3: {
            bucket,
            event
        }
    }]);
}

// attaches generic event handler
export function Handler(...events: IHandlerEvent[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, [], events);
}

function register(target: any, propertyKey: string, middleware: HandlerMiddleware[], events: IHandlerEvent[]): void {
    const metadata: IHandlerMetadata = {
        events,
        middleware,
        propertyKey,
        target
    };
    if (!Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)) {
        Reflect.defineMetadata(MetadataKey.EVENT_HANDLER, [metadata], target.constructor);
    } else {
        const found: IHandlerMetadata[] = Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor);
        const matching: IHandlerMetadata[] = found.filter((handler) => handler.propertyKey === propertyKey);
        if (matching.length === 1) {
            matching[0].events = matching[0].events.concat(events);
            matching[0].middleware = matching[0].middleware.concat(middleware);
        } else {
            found.push(metadata);
        }
    }
}
