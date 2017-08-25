import {Container} from "inversify";
import "reflect-metadata";
import {IServiceData, MetadataKey} from "./service";

export const TYPE = {
    Service: "service",
    EventHandler: "event_handler"
};

// tslint:disable-next-line
export interface Service {}

// tslint:disable-next-line
export interface EventHandler {}

// @todo probably a better way to handle this
let c: Container;
export function register(container: Container): void {
    c = container;

    // register all service handlers with the container
    const services: Service[] = container.getAll<Service>(TYPE.Service);
    services.forEach((service) => {
        const serviceMetadata: IServiceData = Reflect.getOwnMetadata(MetadataKey.SERVICE, service.constructor).data;
        serviceMetadata.handlers.forEach((handler) => {
            container.bind<EventHandler>(TYPE.EventHandler).to(handler).whenTargetNamed(handler.name);
        });
    });
}
export function getContainer(): Container {
    return c;
}
