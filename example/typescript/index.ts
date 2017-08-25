import {Container} from "inversify";
import {IService, register, TYPE} from "../../typescript/lib/index";
import {TestService} from "./test-service";

const container: Container = new Container();

container.bind<IService>(TYPE.Service).to(TestService).whenTargetNamed("TestService");

register(container);
