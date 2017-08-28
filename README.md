[![Coverage Status](https://coveralls.io/repos/github/honerlaw/serverless-inversify-util/badge.svg?branch=master)](https://coveralls.io/github/honerlaw/serverless-inversify-util?branch=master)
[![Build Status](https://travis-ci.org/honerlaw/serverless-inversify-util.svg?branch=master)](https://travis-ci.org/honerlaw/serverless-inversify-util)

## Serverless Inversify Util
Serverless Inversify Util is a simple utility that wraps serverless config generation and mapping with inversify through decorators. This project was heavily inspired by the inversify-express-utils / routing-controllers / spring boot and other similar frameworks / libraries.

## Installation

You can install `serverless-inversify-util` using npm:

```
$ npm install serverless-inversify-util inversify reflect-metadata
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
$ serverless-inversify-util -s ./path/to/entry_point.ts -p ./path/to/tsconfig.json -d -e test
```

The service entry point (`-s`, `--service`) and the tsconfig path (`-p`, `--project`) are required. The paths can be absolute or relative.

There are two optional flags as well. `-d, --deploy` denotes whether the service should be deployed using `serverless deploy` after the generator is done, the default is to *NOT* deploy. `-e, --env` is the environment or stage to deploy to and if not specified will default to the stage specified in the `@Service` decorator. 

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

### RequestEventValue

`RequestEventVaue` resolves a value that is on the event. For example, if `event.path.on.event` should be resolved, passing `path.on.event` would return the value from the event object.

```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestEventValue("path.on.event") event: any): any {
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

### RequestContextValue

`RequestContextValue` resolves a value that is on the context. For example, if `context.path.on.context` should be resolved, passing `path.on.context` would return the value from the context object.

```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestContextValue("path.on.context") ctx: any): any {
        return {
            statusCode: 200,
            body: JSON.stringify({
                event
            })
        };
    }
```

### RequestBody

`RequestBody` resolves a value from the received body. This assumes content type of either `application/json`, `application/x-www-form-urlencoded`, or `multipart/formdata`.

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

### RequestHeaderValue

`RequestHeaderValue` resolves a value from the request headers.

```ts
    @HttpHandler("/testing", "GET")
    public testing(@RequestHeaderValue("Content-Type") one: any): any {
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

## Generator
The generator is the core of `serverless-inversify-util`. It gathers all of the metadata, converts the metadata into a serverless.yml file, generates a handler.js file which maps all of the service handler's to the serverless.yml config, and finally moves all of the necessary files into a folder which is ready to be deployed using `serverless deploy`.

The generator can be extended or used in your own script to allow custom variations of script generation. This may be useful to add automatic deployment for each service or to even build multiple services.

The best way to understand how the generator works is to simply take a look at the `execute` method in [generator.ts](typescript/lib/script/generator.ts).

## TODO
1. Include more of the serverless config definition in the `Service` decorator. 
2. Allow multiple services to be registered.
    1. Accept multiple input entry files. We need to be able to compile and build each service separately.
3. Webpack support through plugins?
4. More default handlers (e.g. S3, etc)
5. Add more documentation around Generator class
5. Service level middleware (basically middleware that can be run first before every single event handler)
6. Better body parsing.
7. Move this list to github issues potentially.