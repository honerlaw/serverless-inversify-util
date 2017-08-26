import "reflect-metadata";
import {Service} from "../../lib/service";
import {MockHandler} from "./mock-handler";
import {injectable} from "inversify";

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
export class MockService {

}
