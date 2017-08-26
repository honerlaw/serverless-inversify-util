## Serverless Inversify Util
Serverless Inversify Util is a simple utility that wraps serverless config generation and mapping with inversify through decorators. This project was heavily inspired by the inversify-express-utils / routing-controllers / spring boot and other similar frameworks / libraries.

## Installation

You can install `serverless-inversify-util` using npm:

```
$ npm install serverless-inversify-util inversify reflect-metadata yamljs ncp typescript
```

The type `serverless-inversify-util` definitions are included in the package as well.

## Basics
### Step 1: Create a Serverless Service

The `Service` decorator takes a config object that will be translated into the serverless.yml file. It also contains some additional metadata to know what handlers are associated with the service.

```ts

import {injectable} from "inversify";
import {Service} from "serverless-inversify-util";
import {TestHandler} from "./test-handler";

@Service({
    service: "test-service",
    provider: {
        name: "aws",
        stage: "test",
        region: "us-east-1"
    },
    handlers: [TestHandler]
})
@injectable()
export class TestService {

}
```

### Step 2: Create a Handler for the Service
A service can contain multiple handlers. However, at least one handler is required.

```ts

import {injectable} from "inversify";
import {HttpHandler, RequestContext, RequestEvent, RequestParam, RequestPath} from "serverless-inversify-util";

@injectable()
export class TestHandler {

    @HttpHandler("/testing/{id}", "GET")
    public testing(@RequestParam("val") val: string,
                   @RequestEvent() event: any,
                   @RequestContext() context: any,
                   @RequestPath("id") path: string): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                val,
                path,
                event,
                context
            })
        };
    }

}

```

### Step 3: Setup the entry point for the serverless service

Now that the service and its handlers are created, the service needs to be added to the inversify container and the container needs to be registered with `serverless-inversify-util`. 

```ts

import {Container} from "inversify";
import {IService, register, TYPE} from "serverless-inversify-util";
import {TestService} from "./test-service";

const container: Container = new Container();

container.bind<IService>(TYPE.Service).to(TestService).whenTargetNamed("TestService");

register(container);
```

### Step 4: Generate deployment directory
Finally, the deployment directory needs to be generated. This directory will contain a generated serverless.yml, a generated handler.js, node_modules directory, and your project's compiled typescript code.

```
$ serverless-inversify-util ./path/to/entry_point.ts ./path/to/tsconfig.json
```

`serverless-inversify-util` may need to be installed globally in order for the above command to run.

## Docs

### RequestParam

`RequestParam` resolves a query parameter given the name of the parameter. The resolved value is not parsed in anyway.

```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestParam("val") one: string): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                one
            })
        };
    }
```

### RequestPath

`RequestPath` resolves a path parameter given the name of the parameter. The resolved value is not parsed in anyway.

```ts
    @HttpHandler("/testing/{id}", "GET")
    public testing(@RequestPath("id") one: string): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                one
            })
        };
    }
```

### RequestEvent

`RequestEvent` resolves the event that serverless receives.


```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestEvent() event: any): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                event
            })
        };
    }
```

### RequestContext

`RequestContext` resolves the context that serverless receives.


```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestContext() ctx: any): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                event
            })
        };
    }
```

### RequestBody

`RequestBody` resolves a value from the received body. **NOTE**: this is not implemented yet.

```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestBody("val") one: any): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                one
            })
        };
    }
```

### HttpHandler

`HttpHandler` defines a handler that will listen for a http event. It requires the path and the method to watch for with the optional ability to have middleware. The middleware is called in the order that it is registered.

```ts
    @HttpHandler("/testing", "GET", (event, context) => {})
    public testing(): any {
        return {
            statusCode: 200
        };
    }
```

### Handler

`Handler` is a generic type of handler that can receive the configuration needed for any type of event. The metadata passed to it will be used to generate the corresponding serverless.yml config. The below example is equivalent to the `HttpHandler`

```ts
    @Handler({
        http: {
            path: "/testing",
            method: "GET"
        }
    })
    public testing(): any {
        return {
            statusCode: 200
        };
    }
```

### Service

`Service` defines the root of the serverless service and all of the necessary metadata to generate and deploy the service.

```ts

@Service({
    service: "test-service",
    provider: {
        name: "aws",
        stage: "test",
        region: "us-east-1",
        environment: {
            "KEY": "value"
        },
        iamRoleStatements: [{
            Effect: "",
            Action: [""],
            Resource: ""
        }]
    },
    handlers: [TestHandler]
})
class TestService {

}

```

## TODO
1. Get tests up and running correctly, need a solid way of testing the template logic as well.
2. Include more of the serverless config definition in the `Service` decorator. Next step will be resources.
3. Allow multiple services to be registered.
4. Clean up the code as much as possible and potentially remove some of the dependencies.
5. Webpack support through plugins?
6. More default handlers (e.g. S3, etc)