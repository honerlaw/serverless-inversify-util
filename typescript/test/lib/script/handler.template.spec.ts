import * as chai from "chai";
import {Container} from "inversify";
import "mocha";
import * as proxyquire from "proxyquire";
import "reflect-metadata";
import * as TypeMoq from "typemoq";
import {IHandlerMetadata} from "../../../lib/handler";
import {IParam, IParamMetadata} from "../../../lib/param";

describe("Handler Template", () => {

    const methodName: string = "methodName";
    const ContainerMock: TypeMoq.IMock<Container> = TypeMoq.Mock.ofType<Container>(Container);
    const handler: any = {};

    let template: any;

    beforeEach(() => {
        ContainerMock
            .setup((x) => x.getNamed(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((type: any, target: any) => handler);

        template = proxyquire.noCallThru().load("../../../lib/script/handler.template", {
            ".{{setup}}": {},
            "../util": {
                TYPE: {
                    EventHandler: "event_handler"
                },
                getContainer: () => ContainerMock.target
            }
        });

        Reflect.defineMetadata("event_handler", [], handler.constructor);
        Reflect.defineMetadata("param", [], handler.constructor);
    });

    afterEach(() => {
        ContainerMock.reset();
    });

    it("should test callback success", () => {
        const resp: any = {
            statusCode: 200,
            body: JSON.stringify({
                message: "success"
            })
        };
        handler[methodName] = () => resp;

        template.handle(methodName, "handlerName", null, null, (err, val) => {
            chai.expect(resp).to.deep.equal(val);
        });
    });

    it("should test callback failure without status code", () => {
        handler[methodName] = () => {
            throw new Error("Hello world!");
        };

        template.handle(methodName, "handlerName", null, null, (err, val) => {
            chai.expect(err).to.not.be.undefined; // tslint:disable-line
            chai.expect(err).to.not.be.null; // tslint:disable-line
            chai.expect(err.message).to.equal("Hello world!");
            chai.expect(val).to.be.undefined; // tslint:disable-line
        });
    });

    it("should test callback failure with status code", () => {
        handler[methodName] = () => {
            const error: any = new Error("Hello world!");
            error.statusCode = 401;
            throw error;
        };

        template.handle(methodName, "handlerName", null, null, (err, val) => {
            chai.expect(val).to.not.be.undefined; // tslint:disable-line
            chai.expect(val).to.not.be.null; // tslint:disable-line
            chai.expect(err).to.be.null; // tslint:disable-line
            chai.expect(val.body).to.equal(JSON.stringify({
                message: "Hello world!"
            }));
            chai.expect(val.statusCode).to.equal(401);
        });
    });

    it("should test callback and call middleware", () => {
        handler[methodName] = function() { // tslint:disable-line
            chai.expect(arguments.length).to.equal(0);
        };

        const event: any = {
            randomEvent: "event"
        };

        const context: any = {
            randomCtx: "context"
        };

        const middleware: any = (e, c) => {
            chai.expect(e).to.deep.equal(event);
            chai.expect(c).to.deep.equal(c);
        };

        const metadata: IHandlerMetadata = {
            events: [],
            middleware: [middleware],
            propertyKey: methodName,
            target: handler.constructor
        };

        Reflect.defineMetadata("event_handler", [metadata], handler.constructor);

        template.handle(methodName, "handlerName", event, context, (err, val) => {
            chai.expect(err).to.be.null; // tslint:disable-line
            chai.expect(val).to.be.undefined; // tslint:disable-line
        });
    });

    describe("parameter parsing", () => {

        const event: any = {
            headers: {
                "Content-Type": "application/json"
            },
            queryStringParameters: {
                testParamKey: "testParam"
            },
            pathParameters: {
                testPathKey: "testPath"
            },
            deep: {
                nested: {
                    value: "eventValue"
                }
            },
            body: JSON.stringify({
                random: "value"
            })
        };

        const context: any = {
            key: "randomValue",
            deep: {
                nested: {
                    value: "contextValue"
                }
            }
        };

        const setup = (...params: IParam[]): void => {
            const metadata: IParamMetadata[] = [];
            params.forEach((param: IParam, index: any) => {
                metadata.push({
                    data: param,
                    target: handler.constructor,
                    propertyKey: methodName,
                    descriptor: index
                });
            });
            Reflect.defineMetadata("param", metadata, handler.constructor);
        };

        const singleParamTest = (type: string, key: string, value: string) => {
            handler[methodName] = (val: string) => {
                chai.expect(val).to.deep.equal(value);
            };

            setup({
                type: type as any,
                name: key
            });

            template.handle(methodName, "handlerName", event, context, (err, val) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(val).to.be.undefined; // tslint:disable-line
            });
        };

        it("should correctly parse and handle each parameter type", () => {
            singleParamTest("param", "testParamKey", "testParam");
            singleParamTest("path", "testPathKey", "testPath");
            singleParamTest("event", undefined, event);
            singleParamTest("event_value", "deep.nested.value", "eventValue");
            singleParamTest("context_value", "deep.nested.value", "contextValue");
            singleParamTest("body", "random", "value");
            singleParamTest("header_value", "Content-Type", "application/json");
            singleParamTest("event_value", "jwtPayload.id", undefined);
        });

        it("should correctly parse and return parameters in order", () => {

            handler[methodName] = (param: string, path: string, e: any, c: any) => {
                chai.expect(param).to.deep.equal("testParam");
                chai.expect(path).to.deep.equal("testPath");
                chai.expect(e).to.deep.equal(event);
                chai.expect(c).to.deep.equal(context);
            };

            setup({
                type: "param",
                name: "testParamKey"
            }, {
                type: "path",
                name: "testPathKey"
            }, {
                type: "event"
            }, {
                type: "context"
            });

            template.handle(methodName, "handlerName", event, context, (err, val) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(val).to.be.undefined; // tslint:disable-line
            });
        });

        it("should correctly parse and return parameters in order even if unknown value", () => {
            handler[methodName] = (param: string, path: string, unknownPath: any,
                                   unknownParam: any, e: any, c: any) => {
                chai.expect(param).to.deep.equal("testParam");
                chai.expect(path).to.deep.equal("testPath");
                chai.expect(unknownPath).to.be.undefined; // tslint:disable-line
                chai.expect(unknownParam).to.be.undefined; // tslint:disable-line
                chai.expect(e).to.deep.equal(event);
                chai.expect(c).to.deep.equal(context);
            };

            setup({
                type: "param",
                name: "testParamKey"
            }, {
                type: "path",
                name: "testPathKey"
            }, {
                type: "path",
                name: "randomPathKey"
            }, {
                type: "param",
                name: "randomParamKey"
            }, {
                type: "event"
            }, {
                type: "context"
            });

            template.handle(methodName, "handlerName", event, context, (err, val) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(val).to.be.undefined; // tslint:disable-line
            });
        });

    });

    describe("getValueFromObject", () => {

        const object: object = {
            random: {
                property: {
                    value: "hello"
                }
            }
        };

        it("should get property off of object", () => {
            const val: string = template.getValueFromObject(object, "random.property.value".split("."));
            const val2: string = template.getValueFromObject(object, "random".split("."));

            chai.expect(val).to.equal("hello");
            chai.expect(val2).to.deep.equal({
                property: {
                    value: "hello"
                }
            });
        });

        it("should fail to get property off of object", () => {
            const val: string = template.getValueFromObject(object, "unknown.property.value".split("."));

            chai.expect(val).to.be.undefined; // tslint:disable-line
        });

    });

});
