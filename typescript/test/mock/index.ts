import {Container} from "inversify";
import {IService, register, TYPE} from "../../lib/util";
import {MockService} from "./mock-service";

const container: Container = new Container();

container.bind<IService>(TYPE.Service).to(MockService).whenTargetNamed("MockService");

register(container);
