import {injectable} from "inversify";
import {HttpHandler} from "../../lib/handler";

@injectable()
export class MockHandler {

    @HttpHandler("/path", "GET")
    public methodOne(): any {
        return {
            statusCode: 200
        };
    }

}
