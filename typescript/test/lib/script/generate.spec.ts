import * as chai from "chai";
import "mocha";
import {Generator} from "../../../lib/script/generator";

describe("Generator", () => {

    it("test compile template", () => {
        const gen: any = new Generator("", "./typescript/tsconfig.json");
        const template: string = gen.getTemplate();

        chai.expect(template).to.not.be.undefined; // tslint:disable-line
        chai.expect(template.length > 0).to.be.true; // tslint:disable-line
    });

});
