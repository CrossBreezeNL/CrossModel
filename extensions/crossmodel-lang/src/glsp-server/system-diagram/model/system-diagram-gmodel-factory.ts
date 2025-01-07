/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/
import { GEdge, GGraph, GModelFactory, GNode, ModelState } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { Entity, EntityNode, RelationshipEdge } from '../../../language-server/generated/ast.js';
import { GInheritanceEdge, GRelationshipEdge } from './edges.js';
import { GEntityNode } from './nodes.js';
import { SystemModelState } from './system-model-state.js';

/**
 * Custom factory that translates the semantic diagram root from Langium to a GLSP graph.
 * Each semantic element in the diagram will be translated to a GModel element on the GLSP side.
 * The GLSP client will later use the GModel to render the SVG elements based on their type.
 */
@injectable()
export class SystemDiagramGModelFactory implements GModelFactory {
   @inject(ModelState) protected readonly modelState!: SystemModelState;

   createModel(): void {
      const newRoot = this.createGraph();
      if (newRoot) {
         // update GLSP root element in state so it can be used in any follow-up actions/commands
         this.modelState.updateRoot(newRoot);
      }
   }

   protected createGraph(): GGraph | undefined {
      const diagramRoot = this.modelState.systemDiagram;
      if (!diagramRoot) {
         return;
      }
      const graphBuilder = GGraph.builder().id(this.modelState.semanticUri);

      const inheritanceIndex = new Map<Entity, Set<EntityNode>>();

      diagramRoot.nodes
         .map(node => {
            if (node.entity.ref) {
               const nodes = inheritanceIndex.get(node.entity.ref) ?? new Set();
               nodes.add(node);
               inheritanceIndex.set(node.entity.ref, nodes);
            }
            return this.createEntityNode(node);
         })
         .forEach(node => graphBuilder.add(node));
      diagramRoot.edges.map(edge => this.createRelationshipEdge(edge)).forEach(edge => graphBuilder.add(edge));
      diagramRoot.nodes
         .filter(node => node.entity.ref?.superEntities.length ?? 0 > 0)
         .map(node => this.createInheritanceEdge(node, inheritanceIndex))
         .forEach(edge => graphBuilder.addChildren(edge));

      return graphBuilder.build();
   }

   protected createEntityNode(node: EntityNode): GNode {
      return GEntityNode.builder().set(node, this.modelState.index).build();
   }

   protected createRelationshipEdge(edge: RelationshipEdge): GEdge {
      return GRelationshipEdge.builder().set(edge, this.modelState.index).build();
   }

   protected createInheritanceEdge(baseNode: EntityNode, inheritanceIndex: Map<Entity, Set<EntityNode>>): GEdge[] {
      if (!baseNode.entity.ref) {
         return [];
      }
      const superEntities = baseNode.entity.ref.superEntities
         .filter(superEntity => superEntity.ref !== undefined)
         .map(superEntity => superEntity.ref!);
      if (!superEntities || superEntities.length === 0) {
         return [];
      }
      return superEntities.flatMap(superEntity => {
         const superNodes = inheritanceIndex.get(superEntity)!;
         return Array.from(superNodes).map(superNode => GInheritanceEdge.builder().set(baseNode, superNode, this.modelState.index).build());
      });
   }
}
