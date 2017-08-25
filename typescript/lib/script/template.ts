export const TEMPLATE: string = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// run the setup file
require(".{{setup}}");

// get serverless-decorators lib in order to get the inversify container
var lib = require("serverless-inversify-util");

var container = lib.getContainer();

// Generic method to handle incoming event and correctly pass on to registered handlers
function handle(methodName, handlerName, event, context, callback) {
    var handler = container.getNamed(lib.TYPE.EventHandler, handlerName);
    var method = handler[methodName];

    // get middleware for this handler's method
    var foundMetadata;
    var metadata = Reflect.getOwnMetadata("event_handler", handler.constructor);
    metadata.forEach(function(m) {
        if (m.propertyKey === methodName) {
            foundMetadata = m;
        }
    });

    var paramCount = 0;
    var passParams = {};
    var params = Reflect.getOwnMetadata("param", handler.constructor);
    params.forEach(function(p) {
        if (p.propertyKey === methodName) {
            if (p.descriptor > paramCount) {
                paramCount = p.descriptor;
            }
            switch (p.data.type) {
                case "event":
                    passParams[p.descriptor] = event;
                    break;
                case "context":
                    passParams[p.descriptor] = context;
                    break;
                case "path":
                    if (event && event.pathParameters) {
                        passParams[p.descriptor] = event.pathParameters[p.data.name];
                    }
                    break;
                case "param":
                    if (event && event.queryStringParameters) {
                        passParams[p.descriptor] = event.queryStringParameters[p.data.name];
                    }
                    break;
                case "body":
                    // @todo implement
                    break;
            }
        }
    });

    var passParamsArr = new Array(paramCount);
    for (var index in passParams) {
        passParamsArr[index] = passParams[index];
    }

    try {
        if (foundMetadata) {
            for (var index in foundMetadata.middleware) {
                foundMetadata.middleware[index](event, context);
            }
        }
        callback(null, method.apply(handler, passParamsArr));
    } catch (err) {
        return callback(err);
    }
}

`;

export const HANDLER_TEMPLATE: string = `function {{functionName}}(event, context, callback) {
    handle("{{methodName}}", "{{handlerName}}", event, context, callback);
}
exports.{{functionName}} = {{functionName}};

`;
