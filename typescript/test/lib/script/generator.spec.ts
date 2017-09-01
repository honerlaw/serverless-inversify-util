import * as chai from "chai";
import * as fs from "fs-extra";
import "mocha";
import * as path from "path";
import * as proxyquire from "proxyquire";
import * as TypeMoq from "typemoq";
import {Generator} from "../../../lib/script/generator";

// @todo more encompassing tests, generator currently blocks out functionality that uses global values from imports or
// @todo functionality that is specific to a non-local package
describe("Generator", () => {

    const GeneratorMock: TypeMoq.IMock<Generator> = TypeMoq.Mock.ofType<Generator>(Generator,
        TypeMoq.MockBehavior.Loose, false, "", {});
    GeneratorMock.callBase = true;

    afterEach(() => {
        GeneratorMock.reset();
    });

    describe("IT: Generator", () => {

        afterEach(() => {
            const dir: string = path.resolve("./build");
            if (fs.existsSync(dir)) {
                fs.emptyDirSync(dir);
                fs.rmdirSync(dir);
            }
        });

        it("test generation on mock data", async () => {
            const gen: Generator = new Generator("./typescript/test/mock/index.ts",
                "./typescript/test/mock/tsconfig.json");
            await gen.execute();

            // simply check if everything was generated, could potentially validate contents
            chai.expect(fs.existsSync(path.resolve("./build/serverless.yml"))).to.be.true; // tslint:disable-line
            chai.expect(fs.existsSync(path.resolve("./build/handler.js"))).to.be.true; // tslint:disable-line
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

        (gen as any).deploy(outDir);

        childMock.verify((x) => x.exec(command, TypeMoq.It.isAny()),
            TypeMoq.Times.exactly(1));
    });

});
