import * as chai from "chai";
import "mocha";
import "reflect-metadata";
import {Handler, HandlerMiddleware, HttpHandler, S3Handler} from "../../lib/handler";
import {MetadataKey} from "../../lib/service";

describe("Handler", () => {

    const target: object = {};
    const propertyKey: string = "test-property";

    afterEach(() => {
        Reflect.deleteMetadata(MetadataKey.EVENT_HANDLER, target.constructor);
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

        Handler({
            custom: {
                value,
                valueTwo,
                valueThree
            }
        })(target, propertyKey, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                custom: {
                    value,
                    valueTwo,
                    valueThree
                }
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

        S3Handler(bucket, event)(target, propertyKey, null);
        S3Handler(bucketTwo, eventTwo)(target, propertyKeyTwo, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
            events: [{
                s3: {
                    bucket,
                    event
                }
            }],
            middleware: [],
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

});
