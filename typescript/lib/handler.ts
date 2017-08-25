import {MetadataKey} from "./service";

export interface IHandlerEvent {
    [type: string]: {
        [key: string]: string;
    };
}

export interface IHandlerMetadata {
    events: IHandlerEvent[];
    middleware: any[];
    propertyKey: string;
    target: any;
}

// http specific event handler
export function HttpHandler(path: string, method: "GET" | "POST" | "DELETE" | "PUT", ...middleware: any[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, middleware, [{
        http: {
            path,
            method
        }
    }]);
}

// attaches generic event handler
export function Handler(...events: IHandlerEvent[]): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register(target, propertyKey, [], events);
}

function register(target: any, propertyKey: string, middleware: any[], events: IHandlerEvent[]): void {
    const metadata: IHandlerMetadata = {
        events,
        middleware,
        propertyKey,
        target
    };
    if (!Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)) {
        Reflect.defineMetadata(MetadataKey.EVENT_HANDLER, [metadata], target.constructor);
    } else {
        Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor).push(metadata);
    }
}
