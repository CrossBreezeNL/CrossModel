/********************************************************************************
 * Copyright (c) 2025 CrossBreeze.
 ********************************************************************************/

import { Command, MaybePromise } from '@eclipse-glsp/server';
import { EntityNode } from '../../language-server/generated/ast.js';

export class CreateInheritanceCommand implements Command {
   private _canUndo = false;
   constructor(
      private sourceNode: EntityNode,
      private targetNode: EntityNode
   ) {}

   execute(): MaybePromise<void> {
      if (this.canUndo()) {
         return;
      }
      this._canUndo = addSuperEntity(this.sourceNode, this.targetNode);
   }

   undo(): MaybePromise<void> {
      if (this.canUndo()) {
         this._canUndo = removeSuperEntity(this.sourceNode, this.targetNode);
      }
   }
   redo(): MaybePromise<void> {
      return this.execute();
   }

   canUndo(): boolean {
      return this._canUndo;
   }
}

export class DeleteInheritanceCommand implements Command {
   private _canUndo = false;
   constructor(
      private sourceNode: EntityNode,
      private targetNode: EntityNode
   ) {}

   execute(): MaybePromise<void> {
      if (this.canUndo()) {
         return;
      }

      this._canUndo = removeSuperEntity(this.sourceNode, this.targetNode);
   }

   undo(): MaybePromise<void> {
      if (this.canUndo()) {
         this._canUndo = addSuperEntity(this.sourceNode, this.targetNode);
      }
   }

   redo(): MaybePromise<void> {
      return this.execute();
   }

   canUndo(): boolean {
      return this._canUndo;
   }
}

export function addSuperEntity(baseEntity: EntityNode, superEntity: EntityNode): boolean {
   if (baseEntity.entity.ref === undefined) {
      return false;
   }
   const superEntities = baseEntity.entity.ref?.superEntities || [];
   const existingSuperEntity = superEntities.find(entity => entity.ref === superEntity.entity.ref);
   if (!existingSuperEntity && superEntity.entity.ref) {
      superEntities.push({ ref: superEntity.entity.ref, $refText: superEntity.entity.$refText });
   }
   baseEntity.entity.ref.superEntities = superEntities;
   return true;
}

export function removeSuperEntity(baseEntity: EntityNode, superEntity: EntityNode): boolean {
   if (baseEntity.entity.ref === undefined) {
      return false;
   }
   const superEntities = baseEntity.entity.ref?.superEntities;
   const index = superEntities?.findIndex(entity => entity.ref === superEntity.entity.ref);
   if (index > -1) {
      superEntities?.splice(index, 1);
   }
   return true;
}
