import * as chai from "chai";
import "mocha";
import * as proxyquire from "proxyquire";
import * as TypeMoq from "typemoq";
import {TemplateBuilder} from "../../../../lib/script/template/template-builder";

describe("TemplateBuilder", () => {

    const TemplateBuilderMock: TypeMoq.IMock<TemplateBuilder> = TypeMoq.Mock.ofType(TemplateBuilder,
        TypeMoq.MockBehavior.Loose, false, "");
    TemplateBuilderMock.callBase = true;

    afterEach(() => {
        TemplateBuilderMock.reset();
    });

    it("should correctly get contents", () => {
        const propertyKey: string = "propertyKey";
        const testHandler: object = {};
        const reqPath: string = "path/to/things";
        const template: string = `require("{{setup}}");
        `;

        TemplateBuilderMock.setup((x: any) => x.getTemplate()).returns(() => template);
        (TemplateBuilderMock as any).object.mainJsPath = reqPath;

        const contents: string = (TemplateBuilderMock.object as any).getContents({
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

    describe("save", () => {

        it("should save file", () => {
            const contents: string = "this is the content of the file";
            const dir: string = "this/is/the/directory";

            const templateBuilder: any = proxyquire.noCallThru()
                .load("../../../../lib/script/template/template-builder", {
                    "fs-extra": {
                        writeFileSync: (p: string, c: string) => {
                            chai.expect(p).to.contain("handler.js");
                            chai.expect(c).to.equal(contents);
                        }
                    }
                }).TemplateBuilder;

            const builder: TypeMoq.IMock<TemplateBuilder> = TypeMoq.Mock.ofType(templateBuilder,
                TypeMoq.MockBehavior.Loose, false, "");
            builder.setup((x: any) => x.getContents()).returns(() => contents);

            builder.object.save(dir, null);
        });

    });

    describe("getTemplate", () => {

        it("test compile template", () => {
            const template: string = (TemplateBuilderMock.object as any).getTemplate();

            chai.expect(template).to.not.be.undefined; // tslint:disable-line
            chai.expect(template.length > 0).to.be.true; // tslint:disable-line
        });

        it("should get template from js path", () => {
            const template: string = "template as string";
            const templateBuilder: any = proxyquire.noCallThru()
                .load("../../../../lib/script/template/template-builder", {
                    "fs-extra": {
                        existsSync: () => true,
                        readFileSync: () => template
                    }
                }).TemplateBuilder;

            const builder: TemplateBuilder = new templateBuilder("");
            const temp = (builder as any).getTemplate();
            chai.expect(temp).to.equal(template);
        });

        it("should fail to get template from ts path", () => {
            const templateBuilder: any = proxyquire.noCallThru()
                .load("../../../../lib/script/template/template-builder", {
                    "fs-extra": {
                        existsSync: (file) => false
                    }
                }).TemplateBuilder;

            const builder: TemplateBuilder = new templateBuilder("");
            chai.expect(() => (builder as any).getTemplate()).to.throw(Error);
        });

    });

});
