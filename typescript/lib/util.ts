import {Container} from "inversify";
import "reflect-metadata";
import {IServiceData, MetadataKey} from "./service";

export const TYPE = {
    Service: "service",
    EventHandler: "event_handler"
};

export interface IHttpEventResponse {
    statusCode?: number;
    body?: string;
    headers?: { [key: string]: string };

    [key: string]: any;
}

// tslint:disable-next-line
export interface IService {
    preHandle?: (event: any, context: any) => Promise<void>;
    postHandle?: (event: any, context: any, resp: any) => Promise<any>;
}

// tslint:disable-next-line
export interface IEventHandler {
}

// @todo probably a better way to handle this
let c: Container;

export function register(container: Container): void {
    c = container;

    // register all service handlers with the container
    const services: IService[] = container.getAll<IService>(TYPE.Service);
    services.forEach((service) => {
        const serviceMetadata: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, service.constructor).data;
        serviceMetadata.handlers.forEach((handler) => {
            container.bind<IEventHandler>(TYPE.EventHandler).to(handler).whenTargetNamed(handler.name);
        });
    });
}

export function getContainer(): Container {
    return c;
}
