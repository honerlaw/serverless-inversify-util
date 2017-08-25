import {injectable} from "inversify";
import {HttpHandler} from "../../typescript/lib/handler";
import {RequestContext, RequestEvent, RequestParam, RequestPath} from "../../typescript/lib/param";

@injectable()
export class TestHandler {

    @HttpHandler("/testing", "GET")
    public methodOne(): void {
        console.log("method one called");
    }

    @HttpHandler("/testing", "GET")
    public methodTwo(@RequestParam("val") val: string,
                     @RequestEvent() event: any,
                     @RequestContext() context: any,
                     @RequestPath("path") path: string): void {
        console.log("method two called", val, path, event, context);
    }

}
