import * as chai from "chai";
import {Container} from "inversify";
import "mocha";
import {IServiceData, MetadataKey} from "../../lib/service";
import {getContainer, IEventHandler, IService, register, TYPE} from "../../lib/util";
import {MockService} from "../mock/mock-service";

describe("Util", () => {

    it("should register all service metadata handlers with the container", () => {
        const container: Container = new Container();
        container.bind<IService>(TYPE.Service).to(MockService).whenTargetNamed("MockService");

        register(container);

        const handlers: IEventHandler[] = container.getAll(TYPE.EventHandler);
        const service: {data: IServiceData} = Reflect.getOwnMetadata(MetadataKey.SERVICE, MockService);

        chai.expect(handlers.length).to.equal(1);
        service.data.handlers.forEach((handler) => {
            handlers.forEach((h) => {
                chai.expect(handler).to.deep.equal(h.constructor);
            });
        });
    });

    it("should get registered container", () => {
        const container: Container = new Container();
        container.bind<IService>(TYPE.Service).to(MockService).whenTargetNamed("MockService");

        register(container);

        chai.expect(getContainer()).to.deep.equal(container);
    });

});
