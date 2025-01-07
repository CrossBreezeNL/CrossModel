/********************************************************************************
 * Copyright (c) 2025 CrossBreeze.
 ********************************************************************************/
import { INHERITANCE_EDGE_TYPE } from '@crossbreeze/protocol';
import {
   ActionDispatcher,
   Command,
   CreateEdgeOperation,
   CreateEdgeOperationHandler,
   MaybePromise,
   ModelState,
   OperationHandler,
   TriggerEdgeCreationAction
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { CreateInheritanceCommand } from '../commands.js';
import { SystemModelState } from '../model/system-model-state.js';

@injectable()
export class SystemDiagramCreateInheritanceOperationHandler extends OperationHandler implements CreateEdgeOperationHandler {
   override readonly label = 'Inheritance';
   readonly elementTypeIds = [INHERITANCE_EDGE_TYPE];
   readonly operationType = CreateEdgeOperation.KIND;
   @inject(ModelState) protected override modelState: SystemModelState;
   @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

   createCommand(operation: CreateEdgeOperation): MaybePromise<Command | undefined> {
      const sourceNode = this.modelState.index.findEntityNode(operation.sourceElementId);
      const targetNode = this.modelState.index.findEntityNode(operation.targetElementId);

      if (!sourceNode || !targetNode || sourceNode.entity.ref === undefined) {
         return undefined;
      }

      return new CreateInheritanceCommand(sourceNode, targetNode);
   }

   protected async createEdge(operation: CreateEdgeOperation): Promise<void> {
      const sourceNode = this.modelState.index.findEntityNode(operation.sourceElementId);
      const targetNode = this.modelState.index.findEntityNode(operation.targetElementId);

      if (!sourceNode || !targetNode || sourceNode.entity.ref === undefined) {
         return;
      }

      const superEntities = sourceNode.entity.ref?.superEntities || [];
      superEntities.push(targetNode.entity);
      sourceNode.entity.ref.superEntities = superEntities;
   }

   getTriggerActions(): TriggerEdgeCreationAction[] {
      return [];
   }
}
