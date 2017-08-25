export const TEMPLATE: string = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// run the setup file
require("{{setup}}");

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

    var passParams = [];
    var params = Reflect.getOwnMetadata("param", handler.constructor);
    params.forEach(function(p) {
        if (p.propertyKey === methodName) {
            switch (p.data.type) {
                case "event":
                    passParams.push(event);
                    break;
                case "context":
                    passParams.push(context);
                    break;
                case "path":
                    passParams.push(event.pathParameters[p.data.name]);
                    break;
                case "param":
                    passParams.push(event.queryStringParameters[p.data.name]);
                    break;
                case "body":
                    // @todo implement
                    break;
                default:
                    passParams.push(undefined);
                    break;
            }
        }
    });

    try {
        if (foundMetadata) {
            for (var index in foundMetadata.middleware) {
                foundMetadata.middleware[index](event, context);
            }
        }
        callback(null, method(...(passParams.reverse())));
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
