## Serverless Inversify Util
Serverless Inversify Util is a simple utility that wraps serverless config generation and mapping with inversify through decorators. To get a better example of how to use these utils please checkout an [example](example). This project was heavily inspired by the inversify-express-utils / routing-controllers / spring boot and other similar frameworks / libraries.

### Use
The [example](example) shows how to create a simple service with at least one handler. However, the serverless.yml config and a handler.js file must be generated in order to properly map the service / handlers to serverless's framework. The generation script must be run to do this.

`ts-node ./path/to/generation.ts ./path/to/main.ts ./path/to/tsconfig.json`

#### Future
1. Add ability to support multiple services.
2. Bundling support (webpack, etc)
3. Refactor / improve generation script
4. Release this as an npm package and update all this readme...