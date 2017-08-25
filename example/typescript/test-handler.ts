import {injectable} from "inversify";
import {HttpHandler} from "../../typescript/lib/handler";

@injectable()
export class TestHandler {

    @HttpHandler("/testing", "GET")
    public methodOne(): void {
        console.log("method one called");
    }

    @HttpHandler("/testing", "GET")
    public methodTwo(): void {
        console.log("method two called");
    }

}
