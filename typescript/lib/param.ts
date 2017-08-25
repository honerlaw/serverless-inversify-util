import {MetadataKey} from "./service";

export interface IParam {
    type: "body" | "path" | "param" | "context" | "event";
    name?: string;
}

export interface IParamMetadata {
    data: IParam;
    target: any;
    propertyKey: string;
    descriptor: PropertyDescriptor;
}

// grab a param from query string
export function RequestParam(name: string): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "param",
        name
    }, target, propertyKey, descriptor);
}

// grab param from the body
export function RequestBody(name: string): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "body",
        name
    }, target, propertyKey, descriptor);
}

// grab param from a path parameter
export function RequestPath(name: string): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "path",
        name
    }, target, propertyKey, descriptor);
}

// return the entire event
export function RequestEvent(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "event"
    }, target, propertyKey, descriptor);
}

// return the context
export function RequestContext(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "context"
    }, target, propertyKey, descriptor);
}

function register(data: IParam, target, propertyKey: string, descriptor: PropertyDescriptor): void {
    const metadata: IParamMetadata = {
        data,
        target,
        propertyKey,
        descriptor
    };
    if (!Reflect.hasOwnMetadata(MetadataKey.PARAM, target.constructor)) {
        Reflect.defineMetadata(MetadataKey.PARAM, [metadata], target.constructor);
    } else {
        Reflect.getOwnMetadata(MetadataKey.PARAM, target.constructor).push(metadata);
    }
}
