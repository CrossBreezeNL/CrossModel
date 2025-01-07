/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/
import { Command, CompoundCommand, DeleteElementOperation, JsonOperationHandler, ModelState, remove } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { EntityNode, RelationshipEdge, isEntityNode, isRelationshipEdge } from '../../../language-server/generated/ast.js';
import { CrossModelCommand } from '../../common/cross-model-command.js';
import { DeleteInheritanceCommand } from '../commands.js';
import { GInheritanceEdge } from '../model/edges.js';
import { SystemModelState } from '../model/system-model-state.js';

@injectable()
export class SystemDiagramDeleteOperationHandler extends JsonOperationHandler {
   operationType = DeleteElementOperation.KIND;

   @inject(ModelState) protected override modelState!: SystemModelState;

   override createCommand(operation: DeleteElementOperation): Command | undefined {
      const deleteInfo = this.findElementsToDelete(operation);
      const commands: Command[] = [];
      if (deleteInfo.nodes.length > 0 || deleteInfo.edges.length > 0) {
         commands.push(new CrossModelCommand(this.modelState, () => this.deleteDiagramElements(deleteInfo)));
      }
      if (deleteInfo.inheritances.length > 0) {
         deleteInfo.inheritances.forEach(inheritanceEdge => {
            const command = this.createInheritanceDeleteCommand(inheritanceEdge);
            if (command) {
               commands.push(command);
            }
         });
      }

      if (commands.length > 1) {
         return new CompoundCommand(commands);
      } else if (commands.length === 1) {
         return commands[0];
      }
      return undefined;
   }

   protected deleteDiagramElements(deleteInfo: DeleteInfo): void {
      const nodes = this.modelState.systemDiagram.nodes;
      remove(nodes, ...deleteInfo.nodes);

      const edges = this.modelState.systemDiagram.edges;
      remove(edges, ...deleteInfo.edges);
   }

   protected findElementsToDelete(operation: DeleteElementOperation): DeleteInfo {
      const deleteInfo: DeleteInfo = { edges: [], nodes: [], inheritances: [] };
      const nonSemanticElements: string[] = [];

      for (const elementId of operation.elementIds) {
         const element = this.modelState.index.findSemanticElement(elementId, isDiagramElement);
         // simply remove any diagram nodes or edges from the diagram
         if (isEntityNode(element)) {
            deleteInfo.nodes.push(element);
            deleteInfo.edges.push(
               ...this.modelState.systemDiagram.edges.filter(edge => edge.sourceNode?.ref === element || edge.targetNode?.ref === element)
            );
         } else if (isRelationshipEdge(element)) {
            deleteInfo.edges.push(element);
         } else if (element === undefined) {
            nonSemanticElements.push(elementId);
         }
      }

      // Iterate through the non-semantic elements and identify inheritances that should be removed
      for (const elementId of nonSemanticElements) {
         const inheritanceEdge = this.modelState.index.findByClass(elementId, GInheritanceEdge);
         if (inheritanceEdge) {
            deleteInfo.inheritances.push(inheritanceEdge);
         }
      }
      return deleteInfo;
   }

   protected createInheritanceDeleteCommand(inheritanceEdge: GInheritanceEdge): Command | undefined {
      const sourceNode = this.modelState.index.findEntityNode(inheritanceEdge.sourceId);
      const targetNode = this.modelState.index.findEntityNode(inheritanceEdge.targetId);

      if (!sourceNode || !targetNode || sourceNode.entity.ref === undefined) {
         return undefined;
      }

      return new DeleteInheritanceCommand(sourceNode, targetNode);
   }
}

function isDiagramElement(item: unknown): item is RelationshipEdge | EntityNode {
   return isRelationshipEdge(item) || isEntityNode(item);
}

interface DeleteInfo {
   nodes: EntityNode[];
   edges: RelationshipEdge[];
   inheritances: GInheritanceEdge[];
}
