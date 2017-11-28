import * as chai from "chai";
import "mocha";
import "reflect-metadata";
import {
    ErrorHandler, ErrorHandlerFunction, Handler, HandlerMiddleware, HttpHandler, IoTHandler, IScheduleHandlerOptions,
    S3Handler, ScheduleHandler
} from "../../lib/handler";
import {MetadataKey} from "../../lib/service";

describe("Handler", () => {

    const target: object = {};
    const propertyKey: string = "test-property";

    afterEach(() => {
        Reflect.deleteMetadata(MetadataKey.EVENT_HANDLER, target.constructor);
    });

    it("should register schedule handler", () => {
        const rate: string = "cron(0 12 * * ? *)";
        const options: IScheduleHandlerOptions = {
            enabled: true
        };
        const middleware: HandlerMiddleware = () => {
            // do nothing
        };

        ScheduleHandler(rate, options, middleware)(target, propertyKey, null);

        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                schedule: {
                    rate,
                    ...options
                }
            }],
            middleware: [middleware],
            target,
            propertyKey
        }]);
    });

    it("should register iot handler", () => {
        const sql: string = "sql";
        const name: string = "name";
        const middleware: HandlerMiddleware = () => {
            // do nothing
        };

        IoTHandler(sql, name, middleware)(target, propertyKey, null);

        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                iot: {
                    sql,
                    name
                }
            }],
            middleware: [middleware],
            target,
            propertyKey
        }]);
    });

    it("should register http handler metadata", () => {
        const path: string = "/path";
        const pathTwo: string = "/path/two";
        const method: "GET" = "GET";
        const methodTwo: "POST" = "POST";

        HttpHandler(path, method)(target, propertyKey, null);
        HttpHandler(pathTwo, methodTwo)(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                http: {
                    path,
                    method
                }
            }, {
                http: {
                    path: pathTwo,
                    method: methodTwo
                }
            }],
            middleware: [],
            target,
            propertyKey
        }]);
    });

    it("should register s3 handler metadata", () => {
        const bucket: string = "bucket";
        const bucketTwo: string = "bucketTwo";
        const event: string = "event";
        const eventTwo: string = "eventTwo";

        S3Handler(bucket, event)(target, propertyKey, null);
        S3Handler(bucketTwo, eventTwo)(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                s3: {
                    bucket,
                    event
                }
            }, {
                s3: {
                    bucket: bucketTwo,
                    event: eventTwo
                }
            }],
            middleware: [],
            target,
            propertyKey
        }]);
    });

    it("should register custom handler", () => {
        const value: string = "one";
        const valueTwo: string = "two";
        const valueThree: string = "three";

        const middleware: HandlerMiddleware = (event: any, context: any) => { // tslint:disable-line
        };
        const middlewareTwo: HandlerMiddleware = (event: any, context: any) => { // tslint:disable-line
        };

        Handler({
            eventMap: {
                custom: {
                    value,
                    valueTwo,
                    valueThree
                }
            },
            middleware: [middleware]
        }, {
            eventMap: {
                customTwo: {
                    value,
                    valueTwo,
                    valueThree
                }
            },
            middleware: [middlewareTwo]
        })(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                custom: {
                    value,
                    valueTwo,
                    valueThree
                },
            }, {
                customTwo: {
                    value,
                    valueTwo,
                    valueThree
                }
            }],
            middleware: [middleware, middlewareTwo],
            target,
            propertyKey
        }]);
    });

    it("should register a custom handler without middleware", () => {
        const value: string = "one";
        const valueTwo: string = "two";
        const valueThree: string = "three";

        Handler({
            eventMap: {
                custom: {
                    value,
                    valueTwo,
                    valueThree
                }
            }
        })(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                custom: {
                    value,
                    valueTwo,
                    valueThree
                },
            }],
            middleware: [],
            target,
            propertyKey
        }]);
    });

    it("should register entire metadata for different propertKey instead of append to events", () => {
        const bucket: string = "bucket";
        const bucketTwo: string = "bucketTwo";
        const event: string = "event";
        const eventTwo: string = "eventTwo";

        const propertyKeyTwo: string = "test-property-two";

        const middleware: HandlerMiddleware = (event: any, context: any) => { // tslint:disable-line
        };

        S3Handler(bucket, event, middleware)(target, propertyKey, null);
        S3Handler(bucketTwo, eventTwo)(target, propertyKeyTwo, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                s3: {
                    bucket,
                    event
                }
            }],
            middleware: [middleware],
            target,
            propertyKey
        }, {
            events: [{
                s3: {
                    bucket: bucketTwo,
                    event: eventTwo
                }
            }],
            middleware: [],
            target,
            propertyKey: propertyKeyTwo
        }]);
    });

    it("should register middleware with the event handler", () => {
        const bucket: string = "bucket";
        const event: string = "event";
        const middleware: HandlerMiddleware = (e: any, c: any) => { // tslint:disable-line
        };
        const middlewareTwo: HandlerMiddleware = (e: any, c: any) => { // tslint:disable-line
        };

        S3Handler(bucket, event, middleware, middlewareTwo)(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                s3: {
                    bucket,
                    event
                }
            }],
            middleware: [middleware, middlewareTwo],
            target,
            propertyKey
        }]);
    });

    it("should properly register both events with the event handler", () => {
        const path: string = "/path";
        const method: "GET" = "GET";
        const bucket: string = "bucket";
        const event: string = "event";
        const middleware: HandlerMiddleware = (e: any, c: any) => { // tslint:disable-line
        };
        const middlewareTwo: HandlerMiddleware = (e: any, c: any) => { // tslint:disable-line
        };

        S3Handler(bucket, event, middleware, middlewareTwo)(target, propertyKey, null);
        HttpHandler(path, method, middleware, middlewareTwo)(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                s3: {
                    bucket,
                    event
                }
            }, {
                http: {
                    path,
                    method
                }
            }],
            middleware: [middleware, middlewareTwo, middleware, middlewareTwo],
            target,
            propertyKey
        }]);
    });

    describe("ErrorHandler", () => {

        it("should register error handler metadata", () => {
            const errorHandler: ErrorHandlerFunction = (err: any) => {
            };

            ErrorHandler(errorHandler)(target, null, null);

            chai.expect(Reflect.getOwnMetadata(MetadataKey.ERROR_HANDLER, target)).to.deep.equal({
                handler: errorHandler
            });
        });

    });

});
