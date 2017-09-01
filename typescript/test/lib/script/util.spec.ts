import * as chai from "chai";
import "mocha";
import * as path from "path";
import * as proxyquire from "proxyquire";
import {IHandlerMetadata} from "../../../lib/handler";
import {IMetadata} from "../../../lib/script/generator";
import * as Util from "../../../lib/script/util";
import {IServiceData} from "../../../lib/service";

describe("Util", () => {

    describe("createServerlessYAML", () => {

        it("should properly generate yaml config", () => {
            const testHandler: object = {};

            const expected: string = `service: 'this is the service name'
            provider:
              stage: test
            functions:
              Object_propKey:
                handler: handler.Object_propKey
                events:
                  -
                    http:
                      path: /hello
                      method: GET
            `.replace(/[ \n]/g, "");

            const createServerlessYAML = proxyquire.noCallThru().load("../../../lib/script/util", {
                "fs-extra": {
                    writeFileSync: (path: string, contents: string) => {
                        chai.expect(path).to.contain("serverless.yml");
                        chai.expect(contents.replace(/[ \n]/g, "")).to.equal(expected);
                    }
                },
            }).createServerlessYAML;

            createServerlessYAML({
                service: {
                    service: "this is the service name",
                    provider: {
                        stage: "test"
                    },
                },
                handlers: [[{
                    events: [{
                        http: {
                            path: "/hello",
                            method: "GET"
                        }
                    }],
                    target: testHandler,
                    propertyKey: "propKey"
                }]]
            }, "some/out/path");

        });

    });

    describe("getService", () => {

        it("should fail because multiple services are present in container", () => {
            const file: string = path.resolve("./typescript/test/mock/multiple-services.ts");
            chai.expect(() => Util.getService([file])).to.throw(Error);
        });

    });

    describe("getMetadata", () => {

        it("should properly extract metadata from service info and metadata", () => {
            const service: object = {};
            const testHandler: object = {};
            const testHandlerTwo: object = {};
            const serviceData: IServiceData = {
                service: "service name",
                provider: {
                    name: "aws",
                    stage: "dev",
                    region: "us-east-1",
                    runtime: "node"
                },
                handlers: [testHandler, testHandlerTwo]
            };

            Reflect.defineMetadata("service", {
                data: serviceData
            }, service.constructor);

            const handlerMetadata: IHandlerMetadata = {
                events: [],
                middleware: [],
                propertyKey: "propKey",
                target: testHandler
            };
            Reflect.defineMetadata("event_handler", [handlerMetadata], testHandler);

            const handlerMetadataTwo: IHandlerMetadata = {
                events: [],
                middleware: [],
                propertyKey: "propKeyTwo",
                target: testHandlerTwo
            };
            Reflect.defineMetadata("event_handler", [handlerMetadataTwo], testHandlerTwo);

            const metadata: IMetadata = Util.getMetadata(service, {
                stage: undefined,
                trim: false
            });

            chai.expect(metadata).to.deep.equal({
                service: serviceData,
                handlers: [[handlerMetadata], [handlerMetadataTwo]],
                trim: false
            });

            const metadataStage: IMetadata = Util.getMetadata(service, {
                stage: "acustomstage",
                trim: false
            });

            serviceData.provider.stage = "acustomstage";
            chai.expect(metadataStage).to.deep.equal({
                service: serviceData,
                handlers: [[handlerMetadata], [handlerMetadataTwo]],
                trim: false
            });
        });

    });

    describe("getFunctionName", () => {

        it("should fail with to long of prefix", () => {
            const propertyKey: string = "methodName";
            const target: object = {};
            const serviceName: string = "this-is-a-very-long-service-name-to-hit-the-max-limit";
            const stageName: string = "this-is-a-long-stage-name";

            chai.expect(() => Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: false
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should fail with to long of full lambda name", () => {
            const propertyKey: string = "methodNameThatIsVeryLongSoItExceedsTheMaxLengthThatIsAllowed";
            const target: object = {};
            const serviceName: string = "service";
            const stageName: string = "test";

            chai.expect(() => Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: false
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should return an untrimmed function name if within max lambda length", () => {
            const propertyKey: string = "methodName";
            const target: object = {};
            const serviceName: string = "service";
            const stageName: string = "test";

            const functionName: string = Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: false
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            });

            chai.expect(functionName).to.equal(`${(target.constructor as any).name}_${propertyKey}`);
        });

        it("should fail because not enough remaining space to trim function name", () => {
            const target: object = {};
            const propertyKey: string = "methodName";
            const serviceName: string = Array(56).join("a");
            const stageName: string = "test";

            chai.expect(() => Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: true
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should correctly trim the function name", () => {
            const target: object = {};
            const propertyKey: string = "methodName";
            const serviceName: string = Array(55).join("a");
            const stageName: string = "test";

            const functionName: string = Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: true
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            });

            chai.expect(functionName).to.equal("O_me");
        });

        it("should not trim because full function name is less than max lambda length", () => {
            const target: object = {};
            const propertyKey: string = "methodName";
            const serviceName: string = Array(20).join("a");
            const stageName: string = "test";

            const functionName: string = Util.getFunctionName({
                service: {
                    service: serviceName,
                    provider: {
                        name: "aws",
                        runtime: "nodejs6.10",
                        region: "us-east-1",
                        stage: stageName
                    },
                    handlers: []
                },
                handlers: [],
                trim: true
            }, {
                events: [],
                middleware: [],
                target,
                propertyKey
            });

            chai.expect(functionName).to.equal(`${(target.constructor as any).name}_${propertyKey}`);
        });

    });

});
