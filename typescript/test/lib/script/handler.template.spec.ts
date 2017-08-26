import {Container} from "inversify";
import "mocha";
import * as proxyquire from "proxyquire";
import "reflect-metadata";
import * as TypeMoq from "typemoq";

describe("Handler Template", () => {

    const ContainerMock: TypeMoq.IMock<Container> = TypeMoq.Mock.ofType<Container>(Container);
    const handler: any = {
        methodName: () => {
            console.log("called");
        }
    };

    let template: any;

    beforeEach(() => {
        ContainerMock
            .setup((x) => x.getNamed(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((type: any, target: any) => handler);

        template = proxyquire.noCallThru().load("../../../lib/script/handler.template", {
            ".{{setup}}": {},
            "serverless-inversify-util": {
                TYPE: {
                    EventHandler: "event_handler"
                },
                getContainer: () => ContainerMock.target
            }
        });

        Reflect.defineMetadata("event_handler", [], handler.constructor);
        Reflect.defineMetadata("param", [], handler.constructor)
    });

    afterEach(() => {
        ContainerMock.reset();
    });

    it("should do some handling", () => {
        template.handle("methodName", "handlerName", null, null, null);
    });

});
