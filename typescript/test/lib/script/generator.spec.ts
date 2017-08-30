import * as chai from "chai";
import * as fs from "fs-extra";
import "mocha";
import * as path from "path";
import * as proxyquire from "proxyquire";
import * as TypeMoq from "typemoq";
import {IHandlerMetadata} from "../../../lib/handler";
import {Generator, IMetadata} from "../../../lib/script/generator";
import {IServiceData} from "../../../lib/service";


// @todo more encompassing tests, generator currently blocks out functionality that uses global values from imports or
// @todo functionality that is specific to a non-local package
describe("Generator", () => {

    const GeneratorMock: TypeMoq.IMock<Generator> = TypeMoq.Mock.ofType<Generator>(Generator,
        TypeMoq.MockBehavior.Loose, false, "", {});
    GeneratorMock.callBase = true;

    afterEach(() => {
        GeneratorMock.reset();
    });

    it("test compile template", () => {
        const template: string = (GeneratorMock.object as any).getTemplate();

        chai.expect(template).to.not.be.undefined; // tslint:disable-line
        chai.expect(template.length > 0).to.be.true; // tslint:disable-line
    });

    it("should correctly get contents", () => {
        const propertyKey: string = "propertyKey";
        const testHandler: object = {};
        const reqPath: string = "path/to/things";
        const template: string = `require("{{setup}}");
        `;

        const contents: string = (GeneratorMock.object as any).getContents(template, reqPath, {
            service: {
                provider: {
                    stage: "test"
                }
            },
            handlers: [[{
                events: [],
                propertyKey,
                middleware: [],
                target: testHandler,
            }]]
        });

        chai.expect(contents.replace(/[ \n]/g, "")).to.equal(`require("path/to/things");
            function Object_propertyKey(event, context, callback) {
                handle("propertyKey", "Object", event, context, callback);
            }
            exports.Object_propertyKey = Object_propertyKey;
            `.replace(/[ \n]/g, ""));
    });

    it("should properly generate yaml config", () => {
        const testHandler: object = {};
        (GeneratorMock.object as any).stage = "hello";
        const yaml: string = (GeneratorMock.object as any).getServerlessYAMLConfig({
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
        });

        chai.expect(yaml.replace(/[ \n]/g, "")).to.equal(`service: 'this is the service name'
            provider:
              stage: hello
            functions:
              Object_propKey:
                handler: handler.Object_propKey
                events:
                  -
                    http:
                      path: /hello
                      method: GET
            `.replace(/[ \n]/g, ""));
    });

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

        const metadata: IMetadata = (GeneratorMock.object as any).getMetadata(service);

        chai.expect(metadata).to.deep.equal({
            service: serviceData,
            handlers: [[handlerMetadata], [handlerMetadataTwo]]
        });
    });

    describe("IT: Generator", () => {

        afterEach(() => {
            const dir: string = path.resolve("./test-bin");
            if (fs.existsSync(dir)) {
                fs.emptyDirSync(dir);
                fs.rmdirSync(dir);
            }
        });

        it("test generation on mock data", () => {
            const gen: Generator = new Generator("./typescript/test/mock/index.ts",
                "./typescript/test/mock/tsconfig.json");
            gen.execute("./test-bin");

            // simply check if everything was generated, could potentially validate contents
            chai.expect(fs.existsSync(path.resolve("./test-bin/testservicename"))).to.be.true; // tslint:disable-line
            chai.expect(fs.existsSync(path.resolve("./test-bin/testservicename/node_modules"))).to.be.true; // tslint:disable-line
            chai.expect(fs.existsSync(path.resolve("./test-bin/testservicename/handler.js"))).to.be.true; // tslint:disable-line
            chai.expect(fs.existsSync(path.resolve("./test-bin/testservicename/serverless.yml"))).to.be.true; // tslint:disable-line
        });

    });

    it("should attempt to deploy the service using a child process", () => {
        const outDir: string = "outDir";
        const command: string = `cd ${outDir} && serverless deploy`;

        interface IChildMock {
            exec: (command: string, callback?: (error: Error, stdout: string, stderr: string) => void) => any;
        }

        const childMock: TypeMoq.IMock<IChildMock> = TypeMoq.Mock.ofType<IChildMock>();
        childMock
            .setup((x) => x.exec(command, TypeMoq.It.isAny()))
            .returns(() => {
                return {
                    stderr: {
                        pipe: (val: any) => {
                            // @todo probably test a better way to see if the proper piping is done
                            chai.expect(val.toString()).to.equal(process.stderr.toString());
                        }
                    },
                    stdout: {
                        pipe: (val: any) => {
                            chai.expect(val.toString()).to.equal(process.stdout.toString());
                        }
                    }
                };
            });

        const GeneratorCon = proxyquire.noCallThru().load("../../../lib/script/generator", {
            child_process: childMock.object,
        }).Generator;

        const gen: Generator = new GeneratorCon("./typescript/test/mock/index.ts",
            "./typescript/test/mock/tsconfig.json", true);

        (gen as any).deployService(outDir);

        childMock.verify((x) => x.exec(command, TypeMoq.It.isAny()),
            TypeMoq.Times.exactly(1));
    });

    describe("getFunctionName", () => {

        let gen: any;

        beforeEach(() => {
            gen = new Generator("./typescript/test/mock/index.ts", "./typescript/test/mock/tsconfig.json");
        });

        it("should fail with to long of prefix", () => {
            const propertyKey: string = "methodName";
            const target: object = {};
            const serviceName: string = "this-is-a-very-long-service-name-to-hit-the-max-limit";
            const stageName: string = "this-is-a-long-stage-name";

            chai.expect(() => gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should fail with to long of full lambda name", () => {
            const propertyKey: string = "methodNameThatIsVeryLongSoItExceedsTheMaxLengthThatIsAllowed";
            const target: object = {};
            const serviceName: string = "service";
            const stageName: string = "test";

            chai.expect(() => gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should return an untrimmed function name if within max lambda length", () => {
            const propertyKey: string = "methodName";
            const target: object = {};
            const serviceName: string = "service";
            const stageName: string = "test";

            const functionName: string = gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
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

            gen.trim = true;

            chai.expect(() => gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
                target,
                propertyKey
            })).to.throw(Error);
        });

        it("should correctly trim the function name", () => {
            const target: object = {};
            const propertyKey: string = "methodName";
            const serviceName: string = Array(55).join("a");
            const stageName: string = "test";

            gen.trim = true;
            const functionName: string = gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
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

            gen.trim = true;
            const functionName: string = gen.getFunctionName({
                service: serviceName,
                provider: {
                    stage: stageName
                }
            }, {
                target,
                propertyKey
            });

            chai.expect(functionName).to.equal(`${(target.constructor as any).name}_${propertyKey}`);
        });

    });

});
