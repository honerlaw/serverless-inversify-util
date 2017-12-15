import {injectable} from "inversify";
import "reflect-metadata";

import {Service} from "../../lib/service";
import {IService} from "../../lib/util";
import {MockHandler} from "./mock-handler";

@Service({
    service: "test service name",
    provider: {
        name: "aws",
        region: "us-east-1",
        stage: "dev",
        runtime: "node"
    },
    handlers: [MockHandler]
})
@injectable()
export class MockService implements IService {

}
