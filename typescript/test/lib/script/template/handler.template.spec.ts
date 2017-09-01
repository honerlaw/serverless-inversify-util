import * as chai from "chai";
import {Container} from "inversify";
import "mocha";
import * as proxyquire from "proxyquire";
import "reflect-metadata";
import * as TypeMoq from "typemoq";
import {IHandlerMetadata} from "../../../../lib/handler";
import {IParam, IParamMetadata} from "../../../../lib/param";
import {MetadataKey} from "../../../../lib/service";

describe("Handler Template", () => {

    const methodName: string = "methodName";
    const handlerName: string = "handlerName";
    const ContainerMock: TypeMoq.IMock<Container> = TypeMoq.Mock.ofType<Container>(Container);
    const handler: any = {};

    let template: any;

    beforeEach(() => {
        ContainerMock
            .setup((x) => x.getNamed(TypeMoq.It.isAny(), handlerName))
            .returns((type: any, target: any) => handler);

        template = proxyquire.noCallThru().load("../../../../lib/script/template/handler.template", {
            ".{{setup}}": {},
            "{{lib}}": {
                TYPE: {
                    EventHandler: "event_handler"
                },
                getContainer: () => ContainerMock.object
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

        template.handle(methodName, handlerName, null, null, (err, val) => {
            chai.expect(resp).to.deep.equal(val);
        });
    });

    it("should test callback failure without status code", () => {
        handler[methodName] = () => {
            throw new Error("Hello world!");
        };

        template.handle(methodName, handlerName, null, null, (err, val) => {
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

        template.handle(methodName, handlerName, null, null, (err, val) => {
            chai.expect(val).to.not.be.undefined; // tslint:disable-line
            chai.expect(val).to.not.be.null; // tslint:disable-line
            chai.expect(err).to.be.null; // tslint:disable-line
            chai.expect(val.body).to.equal(JSON.stringify({
                message: "Hello world!"
            }));
            chai.expect(val.statusCode).to.equal(401);
        });
    });

    it("should test callback and call middleware", async () => {
        handler[methodName] = function () { // tslint:disable-line
            chai.expect(arguments.length).to.equal(0);
        };

        const event: any = {
            randomEvent: "event"
        };

        const context: any = {
            randomCtx: "context"
        };

        // test async function passed in with timeout
        const middleware: any = (e, c) => {
            chai.expect(e).to.deep.equal(event);
            chai.expect(c).to.deep.equal(c);
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 500);
            });
        };

        const metadata: IHandlerMetadata = {
            events: [],
            middleware: [middleware],
            propertyKey: methodName,
            target: handler.constructor
        };

        // mock middleware to validate it wasn't called
        const middlewareTwoFunc: TypeMoq.IMock<(e: any, c: any) => void> = TypeMoq.Mock
            .ofInstance((e: any, c: any) => {}); // tslint:disable-line

        const metadataTwo: IHandlerMetadata = {
            events: [],
            middleware: [middlewareTwoFunc.object],
            propertyKey: "random",
            target: handler.constructor
        };

        Reflect.defineMetadata("event_handler", [metadata, metadataTwo], handler.constructor);

        await template.handle(methodName, handlerName, event, context, (err, val) => {
            chai.expect(err).to.be.null; // tslint:disable-line
            chai.expect(val).to.be.undefined; // tslint:disable-line
        });

        middlewareTwoFunc.verify((x) => x(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(0));
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

            template.handle(methodName, handlerName, event, context, (err, val) => {
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

            template.handle(methodName, handlerName, event, context, (err, val) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(val).to.be.undefined; // tslint:disable-line
            });
        });

        it("should fail to find handler metadata", () => {
            handler[methodName] = (param: string) => {
                chai.expect(param).to.deep.equal("testParam");
            };

            setup({
                type: "param",
                name: "testParamKey"
            });

            template.handle("", handlerName, event, context, (err, val) => {
                chai.expect(err.message).to.equal("Method for event handler not found!"); // tslint:disable-line
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

            template.handle(methodName, handlerName, event, context, (err, val) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(val).to.be.undefined; // tslint:disable-line
            });
        });

        it("should attempt to grab header information whether the header exists or not", () => {
            const method: any = (param: any) => { // tslint:disable-line
            };

            setup({
                type: "header_value",
                name: "propKey"
            });

            const resOne: any[] = template.getPassParams(handler, method, methodName, null, {});
            const resTwo: any[] = template.getPassParams(handler, method, methodName, {}, {});
            const resThree: any[] = template.getPassParams(handler, method, methodName, {
                headers: {}
            }, {});
            const resFour: any[] = template.getPassParams(handler, method, methodName, {
                headers: {
                    propKey: "hello"
                }
            }, {});

            chai.expect(resOne).to.deep.equal([undefined]);
            chai.expect(resTwo).to.deep.equal([undefined]);
            chai.expect(resThree).to.deep.equal([undefined]);
            chai.expect(resFour).to.deep.equal(["hello"]);
        });

        it("should attempt to parse and grab body value", () => {
            const method: any = (param: any) => { // tslint:disable-line
            };

            setup({
                type: "body",
                name: "propKey"
            });

            const resOne: any[] = template.getPassParams(handler, method, methodName, null, {});
            const resTwo: any[] = template.getPassParams(handler, method, methodName, {}, {});
            const resThree: any[] = template.getPassParams(handler, method, methodName, {
                headers: {}
            }, {});
            const resFour: any[] = template.getPassParams(handler, method, methodName, {
                body: {}
            }, {});
            const resFive: any[] = template.getPassParams(handler, method, methodName, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: "propKey=random&propKeyTwo=randomTwo"
            }, {});
            const resSix: any[] = template.getPassParams(handler, method, methodName, {
                headers: {
                    "Content-Type": "unknown"
                },
                body: "propKey=random&propKeyTwo=randomTwo"
            }, {});

            chai.expect(resOne).to.deep.equal([undefined]);
            chai.expect(resTwo).to.deep.equal([undefined]);
            chai.expect(resThree).to.deep.equal([undefined]);
            chai.expect(resFour).to.deep.equal([undefined]);
            chai.expect(resFive).to.deep.equal(["random"]);
            chai.expect(resSix).to.deep.equal([undefined]);
        });

        it("should do nothing with invalid method name", () => {
            const method: any = (param: any) => { // tslint:disable-line
            };

            setup({
                type: "param",
                name: "test"
            });

            const params: any[] = template.getPassParams(handler, method, "", {}, {});

            chai.expect(params).to.deep.equal([undefined]);
        });

        it("path param will be undefined if invalid event", () => {
            const method: any = (param: any) => { // tslint:disable-line
            };

            setup({
                type: "path",
                name: "randomProp"
            });

            const resOne: any[] = template.getPassParams(handler, method, methodName, null, {});
            const resTwo: any[] = template.getPassParams(handler, method, methodName, {}, {});
            const resThree: any[] = template.getPassParams(handler, method, methodName, {
                pathParameters: {
                    randomProp: "hello"
                }
            }, {});

            chai.expect(resOne).to.deep.equal([undefined]);
            chai.expect(resTwo).to.deep.equal([undefined]);
            chai.expect(resThree).to.deep.equal(["hello"]);
        });

        it("query param will be undefined if invalid event", () => {
            const method: any = (param: any) => { // tslint:disable-line
            };

            setup({
                type: "param",
                name: "randomProp"
            });

            const resOne: any[] = template.getPassParams(handler, method, methodName, null, {});
            const resTwo: any[] = template.getPassParams(handler, method, methodName, {}, {});
            const resThree: any[] = template.getPassParams(handler, method, methodName, {
                queryStringParameters: {
                    randomProp: "hello"
                }
            }, {});

            chai.expect(resOne).to.deep.equal([undefined]);
            chai.expect(resTwo).to.deep.equal([undefined]);
            chai.expect(resThree).to.deep.equal(["hello"]);
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

    describe("No Params", () => {

        beforeEach(() => {
            Reflect.deleteMetadata("param", handler.constructor);
        });

        it("should correctly parse params when no params are available", () => {
            const resp: any = {
                statusCode: 200,
                body: JSON.stringify({
                    message: "success"
                })
            };
            handler[methodName] = (param: any) => {
                chai.expect(param).to.be.undefined; // tslint:disable-line
                return resp;
            };

            template.handle(methodName, handlerName, null, null, (err, val) => {
                chai.expect(resp).to.deep.equal(val);
            });
        });

    });

    describe("getParsedValue", () => {

        it("should parse value with given parser", () => {
            const val: number = template.getParsedValue({
                type: "param",
                parse: Number
            }, "15");

            chai.expect(val).to.be.a("number");
        });

        it("should not parse value at all", () => {
            const testVal: string = "hello";
            const val: any = template.getParsedValue({
                type: "param"
            }, testVal);

            chai.expect(val).to.equal(testVal);
        });

    });

    describe("ErrorHandler", () => {

        it("should call error handler if an error is thrown and return the err in the event callback", () => {
            const customHandler: object = {};
            customHandler[methodName] = () => {
                throw new Error("Error thrown in handler function");
            };
            const customHandlerName: string = "custom_handler_name";

            Reflect.defineMetadata(MetadataKey.ERROR_HANDLER, {
                handler: (err: any) => {
                    chai.expect(err.message).to.equal("Error thrown in handler function");
                }
            }, handler.constructor);

            ContainerMock
                .setup((x) => x.getNamed(TypeMoq.It.isAny(), customHandlerName))
                .returns((type: any, target: any) => customHandler);

            template.handle(methodName, customHandlerName, methodName, {}, (err, res) => {
                chai.expect(err.message).to.equal("Error thrown in handler function");
                chai.expect(res).to.be.undefined; // tslint:disable-line
            });
        });

        it("should call error handler if an error is thrown and return the error handler response", () => {
            const customHandler: object = {};
            customHandler[methodName] = () => {
                throw new Error("Error thrown in handler function");
            };
            const customHandlerName: string = "custom_handler_name";

            const customResp: any = {
                statusCode: 500,
                body: JSON.stringify({
                    message: "custom error message"
                })
            };

            Reflect.defineMetadata(MetadataKey.ERROR_HANDLER, {
                handler: (err: any) => {
                    chai.expect(err.message).to.equal("Error thrown in handler function");
                    return customResp;
                }
            }, handler.constructor);

            ContainerMock
                .setup((x) => x.getNamed(TypeMoq.It.isAny(), customHandlerName))
                .returns((type: any, target: any) => customHandler);

            template.handle(methodName, customHandlerName, methodName, {}, (err, res) => {
                chai.expect(err).to.be.null; // tslint:disable-line
                chai.expect(res).to.equal(customResp);
            });
        });

    });

});
