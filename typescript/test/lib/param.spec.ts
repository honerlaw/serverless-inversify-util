import * as chai from "chai";
import "mocha";
import "reflect-metadata";
import {
    ParseFunction, RequestBody, RequestContext, RequestContextValue, RequestEvent, RequestEventValue,
    RequestHeaderValue, RequestParam,
    RequestPath
} from "../../lib/param";
import {MetadataKey} from "../../lib/service";

describe("Param", () => {

    const target: object = {};

    function validate(type: string, noData: boolean = false): void {
        const propertyKey: string = "test";
        const name: string = "test-name";
        const parse: ParseFunction = Number;
        const descriptor: any = 1;

        switch (type) {
            case "param":
                RequestParam(name, parse)(target, propertyKey, descriptor);
                break;
            case "body":
                RequestBody(name, parse)(target, propertyKey, descriptor);
                break;
            case "path":
                RequestPath(name, parse)(target, propertyKey, descriptor);
                break;
            case "event_value":
                RequestEventValue(name, parse)(target, propertyKey, descriptor);
                break;
            case "context_value":
                RequestContextValue(name, parse)(target, propertyKey, descriptor);
                break;
            case "header_value":
                RequestHeaderValue(name, parse)(target, propertyKey, descriptor);
                break;
            case "event":
                RequestEvent()(target, propertyKey, descriptor);
                break;
            case "context":
                RequestContext()(target, propertyKey, descriptor);
                break;
        }

        const data: any = {
            type
        };
        if (noData === false) {
            data.name = name;
            data.parse = parse;
        }
        chai.expect(Reflect.hasOwnMetadata(MetadataKey.PARAM, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.PARAM, target.constructor)).to.deep.equal([{
            data,
            target,
            propertyKey,
            descriptor
        }]);

        // remove metadata
        Reflect.deleteMetadata(MetadataKey.PARAM, target.constructor);
    }

    it("should correctly register metadata with refelect metadata", () => {
        validate("param");
        validate("body");
        validate("path");
        validate("event_value");
        validate("context_value");
        validate("header_value");
        validate("event", true);
        validate("context", true);
    });

    it("should append metadata with existing metadata", () => {
        const propertyKey: string = "test";
        const name: string = "test-name";
        const nameTwo: string = "test-name-two";

        RequestParam(name)(target, propertyKey, 1);
        RequestParam(nameTwo)(target, propertyKey, 2);

        chai.expect(Reflect.hasOwnMetadata(MetadataKey.PARAM, target.constructor)).to.be.true; // tslint:disable-line
        chai.expect(Reflect.getOwnMetadata(MetadataKey.PARAM, target.constructor)).to.deep.equal([{
            data: {
                type: "param",
                name,
                parse: undefined
            },
            target,
            propertyKey,
            descriptor: 1
        }, {
            data: {
                type: "param",
                name: nameTwo,
                parse: undefined
            },
            target,
            propertyKey,
            descriptor: 2
        }]);
    });

});
