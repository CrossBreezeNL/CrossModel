/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/

import { AstNode, isReference } from 'langium';
import { CrossModelRoot, DiagramNode, Entity } from '../language-server/generated/ast';
import { Disposable } from 'vscode-jsonrpc';
import * as rpc from 'vscode-jsonrpc/node';
import { ModelService } from './model-service';

const OpenModel = new rpc.RequestType1<string, void, void>('server/open');
const CloseModel = new rpc.RequestType1<string, void, void>('server/close');
const RequestModel = new rpc.RequestType1<string, AstNode | undefined, void>('server/request');
const RequestModelDiagramNode = new rpc.RequestType2<string, string, DiagramNodeEntity | undefined, void>('server/requestModelDiagramNode');
const UpdateModel = new rpc.RequestType2<string, AstNode, void, void>('server/update');
const SaveModel = new rpc.RequestType2<string, AstNode, void, void>('server/save');
const OnSave = new rpc.NotificationType2<string, AstNode>('server/onSave');

/**
 * The model server handles request messages on the RPC connection and ensures that any return value
 * can be sent to the client by ensuring proper serialization of semantic models.
 */
export class ModelServer implements Disposable {
    protected toDispose: Disposable[] = [];

    constructor(protected connection: rpc.MessageConnection, protected modelService: ModelService) {
        this.initialize(connection);
    }

    protected initialize(connection: rpc.MessageConnection): void {
        this.toDispose.push(connection.onRequest(OpenModel, uri => this.openModel(uri)));
        this.toDispose.push(connection.onRequest(CloseModel, uri => this.closeModel(uri)));
        this.toDispose.push(connection.onRequest(RequestModel, uri => this.requestModel(uri)));
        this.toDispose.push(connection.onRequest(RequestModelDiagramNode, (uri, id) => this.requestModelDiagramNode(uri, id)));
        this.toDispose.push(connection.onRequest(UpdateModel, (uri, model) => this.updateModel(uri, model)));
        this.toDispose.push(connection.onRequest(SaveModel, (uri, model) => this.saveModel(uri, model)));
    }

    /**
     * Returns the entity model of the selected node in the diagram.
     *
     * @param uri The uri of the opened diagram
     * @param id The id of the selected node
     * @returns {
     *  uri: of the entity model
     *  entity: model of the entity
     * }
     */
    async requestModelDiagramNode(uri: string, id: string): Promise<DiagramNodeEntity | undefined> {
        const root = (await this.modelService.request(uri)) as CrossModelRoot;
        let diagramNode: DiagramNode | undefined = undefined;

        if (!root || !root.diagram) {
            throw new Error('Something went wrong loading the diagram');
        }

        for (const node of root.diagram.nodes) {
            if (node.name === id) {
                if (diagramNode) {
                    throw new Error('Multiple nodes with the same name');
                }

                diagramNode = node;
            }
        }

        if (!diagramNode) {
            throw new Error('No node found with the given id');
        }

        const ref: Entity | undefined = diagramNode.semanticElement.ref;

        if (!ref || !ref.$container.$document) {
            throw new Error('No node found with the given id');
        }

        const entityUri = ref.$container.$document.uri.toString();
        const serializedEntity: CrossModelRoot | undefined = toSerializable({
            $type: 'CrossModelRoot',
            entity: diagramNode.semanticElement.ref
        });

        return {
            uri: entityUri,
            model: serializedEntity
        };
    }

    protected async openModel(uri: string): Promise<void> {
        await this.modelService.open(uri);

        this.modelService.onSave(uri, newModel => {
            // TODO: Research if this also has to be closed after the document closes
            this.connection.sendNotification(OnSave, uri, toSerializable(newModel));
        });
    }

    protected async closeModel(uri: string): Promise<void> {
        await this.modelService.close(uri);
    }

    protected async requestModel(uri: string): Promise<AstNode | undefined> {
        const root = await this.modelService.request(uri);
        return toSerializable(root);
    }

    protected async updateModel(uri: string, model: AstNode): Promise<void> {
        await this.modelService.update(uri, model);
    }

    protected async saveModel(uri: string, model: AstNode): Promise<void> {
        await this.modelService.save(uri, model);
    }

    dispose(): void {
        this.toDispose.forEach(disposable => disposable.dispose());
    }
}

/**
 * Cleans the semantic object of any property that cannot be serialized as a String and thus cannot be sent to the client
 * over the RPC connection.
 *
 * @param obj semantic object
 * @returns serializable semantic object
 */
export function toSerializable<T extends object>(obj?: T): T | undefined {
    if (!obj) {
        return;
    }
    // We remove all $<property> from the semantic object with the exception of type
    // they are added by Langium but have no additional value on the client side
    // Furtermore we ensure that for references we use their string representation ($refText)
    // instead of their real value to avoid sending whole serialized object graphs
    return <T>Object.entries(obj)
        .filter(([key, value]) => !key.startsWith('$') || key === '$type')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: cleanValue(value) }), {});
}

function cleanValue(value: any): any {
    if (Array.isArray(value)) {
        return value.map(cleanValue);
    } else if (isContainedObject(value)) {
        return toSerializable(value);
    } else {
        return resolvedValue(value);
    }
}

function isContainedObject(value: any): boolean {
    return value === Object(value) && !isReference(value);
}

function resolvedValue(value: any): any {
    if (isReference(value)) {
        return value.$refText;
    }
    return value;
}

interface DiagramNodeEntity {
    uri: string;
    model: CrossModelRoot | undefined;
}
