"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
require("mocha");
require("reflect-metadata");
var handler_1 = require("../../lib/handler");
var service_1 = require("../../lib/service");
describe("Handler", function () {
    var target = {};
    var propertyKey = "test-property";
    afterEach(function () {
        Reflect.deleteMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor);
    });
    it("should register http handler metadata", function () {
        var path = "/path";
        var pathTwo = "/path/two";
        var method = "GET";
        var methodTwo = "POST";
        handler_1.HttpHandler(path, method)(target, propertyKey, null);
        handler_1.HttpHandler(pathTwo, methodTwo)(target, propertyKey, null);
        chai.expect(Reflect.hasOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
                events: [{
                        http: {
                            path: path,
                            method: method
                        }
                    }, {
                        http: {
                            path: pathTwo,
                            method: methodTwo
                        }
                    }],
                middleware: [],
                target: target,
                propertyKey: propertyKey
            }]);
    });
    it("should register s3 handler metadata", function () {
        var bucket = "bucket";
        var bucketTwo = "bucketTwo";
        var event = "event";
        var eventTwo = "eventTwo";
        handler_1.S3Handler(bucket, event)(target, propertyKey, null);
        handler_1.S3Handler(bucketTwo, eventTwo)(target, propertyKey, null);
        chai.expect(Reflect.hasOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
                events: [{
                        s3: {
                            bucket: bucket,
                            event: event
                        }
                    }, {
                        s3: {
                            bucket: bucketTwo,
                            event: eventTwo
                        }
                    }],
                middleware: [],
                target: target,
                propertyKey: propertyKey
            }]);
    });
    it("should register custom handler", function () {
        var value = "one";
        var valueTwo = "two";
        var valueThree = "three";
        handler_1.Handler({
            custom: {
                value: value,
                valueTwo: valueTwo,
                valueThree: valueThree
            }
        })(target, propertyKey, null);
        chai.expect(Reflect.hasOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
                events: [{
                        custom: {
                            value: value,
                            valueTwo: valueTwo,
                            valueThree: valueThree
                        }
                    }],
                middleware: [],
                target: target,
                propertyKey: propertyKey
            }]);
    });
    it("should register entire metadata for different propertKey instead of append to events", function () {
        var bucket = "bucket";
        var bucketTwo = "bucketTwo";
        var event = "event";
        var eventTwo = "eventTwo";
        var propertyKeyTwo = "test-property-two";
        handler_1.S3Handler(bucket, event)(target, propertyKey, null);
        handler_1.S3Handler(bucketTwo, eventTwo)(target, propertyKeyTwo, null);
        chai.expect(Reflect.hasOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
                events: [{
                        s3: {
                            bucket: bucket,
                            event: event
                        }
                    }],
                middleware: [],
                target: target,
                propertyKey: propertyKey
            }, {
                events: [{
                        s3: {
                            bucket: bucketTwo,
                            event: eventTwo
                        }
                    }],
                middleware: [],
                target: target,
                propertyKey: propertyKeyTwo
            }]);
    });
    it("should register middleware with the event handler", function () {
        var bucket = "bucket";
        var event = "event";
        var middleware = function (e, c) {
        };
        var middlewareTwo = function (e, c) {
        };
        handler_1.S3Handler(bucket, event, middleware, middlewareTwo)(target, propertyKey, null);
        chai.expect(Reflect.hasOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(service_1.MetadataKey.EVENT_HANDLER, target.constructor)).to.deep.equal([{
                events: [{
                        s3: {
                            bucket: bucket,
                            event: event
                        }
                    }],
                middleware: [middleware, middlewareTwo],
                target: target,
                propertyKey: propertyKey
            }]);
    });
});
