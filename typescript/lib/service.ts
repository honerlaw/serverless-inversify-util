/*
Below needs to be converted to a generic source
resources:
  Resources:
    userTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: user
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
          - AttributeName: applicationId
            AttributeType: S
          - AttributeName: email
            AttributeType: S
        KeySchema:
          - AttributeName: applicationId
            KeyType: HASH
          - AttributeName: id
            KeyType: RANGE
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
        GlobalSecondaryIndexes:
          - IndexName: EmailIndex
            KeySchema:
              - AttributeName: email
                KeyType: HASH
            Projection:
              ProjectionType: ALL
            ProvisionedThroughput:
              ReadCapacityUnits: 1
              WriteCapacityUnits: 1

 */

// @todo potentially just use json to yml for now to make life easier?
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
            [key: string]: {
                Type: string;
                Properties: {
                    [key: string]: any;
                }
            }
        }
    };
    handlers: any[];
}

export enum MetadataKey {
    SERVICE = "service",
    EVENT_HANDLER = "event_handler",
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
