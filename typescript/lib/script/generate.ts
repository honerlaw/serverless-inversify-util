#! /usr/bin/env node

import {Generator} from "./generator";

// @todo better argument stuff
if (process.argv.length !== 4) {
    console.error("Invalid usage! Example: generate.ts path/to/service.ts path/to/tsconfig.json");
    process.exit(1);
}

(new Generator(process.argv[2], process.argv[3])).execute();
