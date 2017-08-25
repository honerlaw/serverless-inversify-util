// @todo should probably figure out a better way to load all files up and get the invserify container
import {Container} from "inversify";
import * as path from "path";
import {IService, TYPE} from "../util";

export function getContainer(emittedFiles: string[]): Container {
    let indexReq: any;
    emittedFiles
        .filter((file) => file.indexOf(".js.map") === -1)
        .forEach((file) => {
            const req = require(path.resolve(file));
            if (req.getContainer) {
                indexReq = req;
            }
        });

    // @todo find a better way to handle this and the same in the template below
    if (!indexReq) {
        return require("serverless-inversify-util").getContainer();
    }
    return indexReq.getContainer();
}

export function getServices(emittedFiles: string[]): IService[] {
    const container: Container = getContainer(emittedFiles);
    const services: IService[] = container.getAll<IService>(TYPE.Service);
    if (services.length !== 1) {
        console.error("Only one service can be generated at a time!");
        process.exit(1);
    }
    return services;
}