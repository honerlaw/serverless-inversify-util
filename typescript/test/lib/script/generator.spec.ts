import * as chai from "chai";
import * as fs from "fs-extra";
import "mocha";
import * as path from "path";
import * as TypeMoq from "typemoq";
import {IHandlerMetadata} from "../../../lib/handler";
import {Generator, IMetadata} from "../../../lib/script/generator";
import {IServiceData} from "../../../lib/service";

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
        const yaml: string = (GeneratorMock.object as any).getServerlessYAMLConfig({
            service: {
                service: "this is the service name"
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
            functions:
              propKey:
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
                // fs.emptyDirSync(dir);
                // fs.rmdirSync(dir);
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

});
