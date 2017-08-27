import {MetadataKey} from "./service";

export type ParseFunction = (val: any) => any;

export type ParamType = "body" | "path" | "param" | "context" | "event"
    | "event_value" | "context_value" | "header_value";

export interface IParam {
    type: ParamType;
    name?: string;
    parse?: ParseFunction;
}

export interface IParamMetadata {
    data: IParam;
    target: any;
    propertyKey: string;
    descriptor: PropertyDescriptor;
}

// grab a param from query string
export function RequestParam(name: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "param",
        name,
        parse
    }, target, propertyKey, descriptor);
}

// grab param from the body
export function RequestBody(name: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "body",
        name,
        parse
    }, target, propertyKey, descriptor);
}

// grab param from a path parameter
export function RequestPath(name: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "path",
        name,
        parse
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

// return a value from the event (e.g. path = random.key would return event.random.key)
export function RequestEventValue(path: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "event_value",
        parse
    }, target, propertyKey, descriptor);
}

// return a value from the context (e.g. path = random.key would return context.random.key)
export function RequestContextValue(path: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "context_value",
        parse
    }, target, propertyKey, descriptor);
}

export function RequestHeaderValue(header: string, parse?: ParseFunction): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => register({
        type: "header_value",
        parse
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
