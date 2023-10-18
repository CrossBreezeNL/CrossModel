/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/
import { waitForTemporaryFileContent } from '@crossbreeze/core/lib/node';
import {
    CloseModel,
    CloseModelArgs,
    CrossModelRoot,
    DiagramNodeEntity,
    MODELSERVER_PORT_FILE,
    OnSave,
    OnUpdated,
    OpenModel,
    OpenModelArgs,
    PORT_FOLDER,
    RequestModel,
    RequestModelDiagramNode,
    SaveModel,
    SaveModelArgs,
    UpdateModel,
    UpdateModelArgs
} from '@crossbreeze/protocol';
import { URI } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WorkspaceServer } from '@theia/workspace/lib/common';
import * as net from 'net';
import * as rpc from 'vscode-jsonrpc/node';
import { ModelService, ModelServiceClient } from '../common/model-service-rpc';

/**
 * Backend service implementation that mainly forwards all requests from the Theia frontend to the model server exposed on a given socket.
 */
@injectable()
export class ModelServiceImpl implements ModelService, BackendApplicationContribution {
    protected initialized?: Deferred<void>;
    protected connection: rpc.MessageConnection;
    protected client?: ModelServiceClient;

    @inject(WorkspaceServer) protected workspaceServer: WorkspaceServer;

    initialize(): void {
        // try to connect to server as early as possible and not only on first request
        this.initializeServer();
    }

    protected initializeServer(): Promise<void> {
        if (this.initialized) {
            return this.initialized.promise;
        }
        const initialized = new Deferred<void>();
        this.initialized = initialized;
        this.waitForPort()
            .then(port => this.connectToServer(port))
            .catch(err => initialized.reject(err))
            .then(() => initialized.resolve())
            .catch(err => initialized.reject(err));
        return initialized.promise;
    }

    protected async connectToServer(port: number): Promise<void> {
        const connected = new Deferred<void>();
        const socket = new net.Socket();
        const reader = new rpc.SocketMessageReader(socket);
        const writer = new rpc.SocketMessageWriter(socket);
        this.connection = rpc.createMessageConnection(reader, writer);

        this.connection.onClose(() => connected.reject('No connection to ModelServer.'));
        socket.on('close', () => connected.reject('No connection to ModelServer'));
        socket.on('ready', () => connected.resolve());
        socket.on('error', error => console.error('Error was thrown on the ModelServer connection: %s; %s', error.name, error.message));
        socket.connect({ port });
        this.connection.listen();

        this.setUpListeners();
        return connected.promise;
    }

    async waitForPort(): Promise<number> {
        // the automatically assigned port is written by the server to a specific file location
        // we wait for that file to be available and read the port number out of it
        // that way we can ensure that the server is ready to accept our connection
        const workspace = await this.workspaceServer.getMostRecentlyUsedWorkspace();
        if (!workspace) {
            throw new Error('No workspace set.');
        }
        const portFile = new URI(workspace).path.join(PORT_FOLDER, MODELSERVER_PORT_FILE).fsPath();
        const port = await waitForTemporaryFileContent(portFile);
        return Number.parseInt(port, 10);
    }

    async open(args: OpenModelArgs): Promise<CrossModelRoot | undefined> {
        await this.initializeServer();
        return this.connection.sendRequest(OpenModel, args);
    }

    async close(args: CloseModelArgs): Promise<void> {
        await this.initializeServer();
        await this.connection.sendRequest(CloseModel, args);
    }

    async request(uri: string): Promise<CrossModelRoot | undefined> {
        await this.initializeServer();
        return this.connection.sendRequest(RequestModel, uri);
    }

    async update(args: UpdateModelArgs<CrossModelRoot>): Promise<CrossModelRoot> {
        await this.initializeServer();
        return this.connection.sendRequest(UpdateModel, args);
    }

    async save(args: SaveModelArgs<CrossModelRoot>): Promise<void> {
        await this.initializeServer();
        return this.connection.sendRequest(SaveModel, args);
    }

    dispose(): void {
        if (this.initialized) {
            this.initialized.resolve();
            this.initialized = undefined;
        }
    }

    async requestDiagramNodeEntityModel(uri: string, id: string): Promise<DiagramNodeEntity | undefined> {
        await this.initializeServer();
        return this.connection.sendRequest(RequestModelDiagramNode, uri, id);
    }

    setUpListeners(): void {
        this.connection.onNotification(OnSave, event => {
            this.client?.updateModel(event);
        });
        this.connection.onNotification(OnUpdated, event => {
            this.client?.updateModel(event);
        });
    }

    setClient(client: ModelServiceClient): void {
        if (this.client) {
            this.dispose();
        }
        this.client = client;
    }
}