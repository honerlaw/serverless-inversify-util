
// grab a param from query string
export function RequestParam(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        console.log("RequestParam(): called", target, propertyKey, descriptor);
    };
}

// grab param from the body
export function RequestBody(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        console.log("RequestBody(): called", target, propertyKey, descriptor);
    };
}

// grab param from a path parameter
export function RequestPath(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        console.log("RequestPath(): called", target, propertyKey, descriptor);
    };
}

// return the entire event
export function RequestEvent(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        console.log("RequestEvent(): called", target, propertyKey, descriptor);
    };
}

// return the context
export function RequestContext(): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        console.log("RequestContext(): called", target, propertyKey, descriptor);
    };
}
