import * as chai from "chai";
import "mocha";
import "reflect-metadata";
import {IServiceData, MetadataKey, Service} from "../../lib/service";

describe("Service", () => {

    it("should set service metadata", () => {
        const target: object = {};

        const data: IServiceData = {
            service: "test",
            provider: {
                name: "aws",
                region: "us-east-1",
                runtime: "nodejs6.10",
                stage: "test"
            },
            handlers: []
        };

        Service(data)(target, null, null);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.SERVICE, target)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.SERVICE, target)).to.deep.equal({
            data
        });
    });

});
