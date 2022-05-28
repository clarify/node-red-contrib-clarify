declare module 'node-red-node-test-helper' {
  import {SinonStub} from 'sinon';
  import type {SuperTest, Test} from 'supertest';
  export type StatusStubType = SinonStub<[{text?: string; fill?: string; shape?: string}]>;
  export type SendErrorType = SinonStub;
  export type ErrorStubType = SinonStub;

  export interface Node {
    status: StatusStubType;
    send: SendErrorType;
    error: ErrorStubType;
    receive(args: unknown): void;
  }

  export type Flow = {
    id: string;
    type: string;
    name?: string;
    wires?: string[][];
  } & {[key: string]: string | number | undefined | string[][]};

  export class NodeTestHelper {
    load(nodes: unknown[], flow: Flow[], credentials: {[key: string]: unknown}): Promise<void>;
    settings(settings: {[key: string]: unknown}): void;
    startServer(resolve: () => void): void;
    stopServer(resolve: () => void): void;
    unload(): void;
    getNode(nodeId: string): Node;
    clearFlows(): void;
    url(): string;
    request(): SuperTest<Test>;
  }

  let helper: NodeTestHelper;

  export default helper;
}
