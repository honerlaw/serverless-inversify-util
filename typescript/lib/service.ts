// @todo improve this type definition
export interface IDynamoDBResourceProperties {
    TableName: string;
    AttributeDefinitions?: [{
        AttributeName: string;
        AttributeType: string;
    }];
    KeySchema?: [{
        AttributeName: string;
        KeyType: "HASH" | "RANGE";
    }];
    ProvisionedThroughput?: {
        ReadCapacityUnits?: number;
        WriteCapacityUnits?: number;
    };
    GlobalSecondaryIndexes?: [{
        IndexName: string;
        KeySchema?: [{
            AttributeName: string;
            KeyType: "HASH" | "RANGE";
        }];
        Projection?: {
            ProjectionType: "ALL"
        };
        ProvisionedThroughput?: {
            ReadCapacityUnits?: number;
            WriteCapacityUnits?: number;
        };
    }];
}

export interface IServiceData {
    service: string;
    provider: {
        name: "aws";
        stage: string;
        region: string;
        runtime: string;
        environment?: {
            [key: string]: string;
        };
        iamRoleStatements?: [{
            Effect: string;
            Action: string[];
            Resource: string;
        }];
    };
    resources?: {
        Resources: {
            [resourceName: string]: {
                Type: string;
                Properties: IDynamoDBResourceProperties;
            }
        }
    };
    handlers: any[];

    // @todo allow other properties to be set
    [key: string]: any;
}

export enum MetadataKey {
    SERVICE = "service",
    EVENT_HANDLER = "event_handler",
    ERROR_HANDLER = "error_handler",
    PARAM = "param"
}

// designates a class that is the root for the service
export function Service(data: IServiceData): any {
    return (target, propertyKey: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(MetadataKey.SERVICE, {
            data
        }, target);
    };
}
