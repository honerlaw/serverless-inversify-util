import {injectable} from "inversify";
import {Service} from "../../typescript/lib/service";
import {TestHandler} from "./test-handler";

@Service({
    name: "test-service",
    provider: {
        name: "aws",
        stage: "dev",
        region: "us-east-1",
        iamRoleStatements: [{
            Effect: "",
            Action: [""],
            Resource: "*"
        }]
    },
    handlers: [TestHandler]
})
@injectable()
export class TestService {

}
