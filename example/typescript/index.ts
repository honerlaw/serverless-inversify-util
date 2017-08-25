import {Container} from "inversify";
import {register, Service, TYPE} from "../../typescript/lib/index";
import {TestService} from "./test-service";

const container: Container = new Container();

container.bind<Service>(TYPE.Service).to(TestService).whenTargetNamed("TestService");

register(container);
